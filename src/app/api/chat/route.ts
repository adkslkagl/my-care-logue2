import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { geminiLLM } from "@/src/lib/langchain-llm";
import { getVectorStore } from "@/src/lib/langchain-vectorstore";
import { verifyToken } from "@/src/lib/auth";

// 대화 메시지 타입
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 사용자별 대화 기록 저장 (서버 메모리)
const userChatHistories = new Map<number, ChatMessage[]>();

export async function POST(request: Request) {
  try {
    // 1. 인증 확인
    const decoded = verifyToken(request);
    if (!decoded) {
      return NextResponse.json(
        { error: "인증되지 않은 요청입니다." },
        { status: 401 }
      );
    }

    const { message } = await request.json();

    // 2. 사용자별 대화 기록 가져오기 (없으면 빈 배열)
    let chatHistory = userChatHistories.get(decoded.userId) || [];

    // 3. 벡터 검색 (조건부) - ⚡ 개선 1
    let context = "";
    
    // 건강 기록 관련 키워드가 있을 때만 검색
    const needsHealthRecords = /혈압|혈당|콜레스테롤|검진|기록|수치|결과|처방|진료|병원|검사/i.test(message);
    
    if (needsHealthRecords) {
      const vectorStore = await getVectorStore("health_docs");
      
      const retriever = vectorStore.asRetriever({
        filter: {
          must: [{ key: "userId", match: { value: decoded.userId } }],
        },
        k: 3, // ⚡ 개선 2: 5개 → 3개로 줄임
      });

      const docs = await retriever.invoke(message);
      
      // ⚡ 개선 3: 각 문서 500자만 사용
      context = docs
        .map(doc => doc.pageContent.slice(0, 500))
        .join("\n\n");
    }

    // 4. 대화 기록 (최근 것만) - ⚡ 개선 4
    const recentHistory = chatHistory.slice(-6); // 최근 6개만 (3번 왕복)
    const chatHistoryText = recentHistory
      .map(msg => `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`)
      .join('\n');

    // 5. 프롬프트 템플릿 (간결하게) - ⚡ 개선 5
    const promptTemplate = PromptTemplate.fromTemplate(`
당신은 공감적인 AI 상담사입니다.

${context ? `참고 정보:\n{context}\n` : ''}${chatHistoryText ? `이전 대화:\n{chat_history}\n` : ''}
질문: {question}

간결하고 따뜻하게 2-3문장으로 답변하세요.
답변:
    `);

    // 6. LangChain 체인 생성
    const chain = RunnableSequence.from([
      {
        context: () => context,
        chat_history: () => chatHistoryText,
        question: (input: { question: string }) => input.question,
      },
      promptTemplate,
      geminiLLM,
      new StringOutputParser(),
    ]);

    // 7. 스트리밍 시작
    const stream = await chain.stream({ question: message });

    // 8. 응답 수집용 변수
    let fullResponse = "";

    // 9. ReadableStream 생성
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 스트리밍 청크 처리
          for await (const chunk of stream) {
            if (chunk) {
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
              );
            }
          }

          // 10. 대화 기록 저장
          chatHistory.push({ role: 'user', content: message });
          chatHistory.push({ role: 'assistant', content: fullResponse });
          
          // 최근 20개 메시지만 유지 (10번의 대화)
          if (chatHistory.length > 20) {
            chatHistory = chatHistory.slice(-20);
          }
          
          userChatHistories.set(decoded.userId, chatHistory);

          // 11. 스트림 종료
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}