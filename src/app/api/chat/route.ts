import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { geminiLLM } from "@/src/lib/langchain-llm";
import { hybridSearch } from "@/src/lib/langchain-vectorstore";
import { COLLECTION_NAME } from "@/src/lib/qdrant";
import { verifyToken } from "@/src/lib/auth";

// 대화 메시지 타입
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 사용자별 대화 기록 저장 (서버 메모리)
const userChatHistories = new Map<number, ChatMessage[]>();

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('\n=== 채팅 요청 시작 ===');
  
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
    console.log(`[1] 인증 완료: ${Date.now() - startTime}ms`);
    console.log(`질문: "${message}"`);

    // 2. 사용자별 대화 기록 가져오기 (없으면 빈 배열)
    let chatHistory = userChatHistories.get(decoded.userId) || [];

    // 3. 벡터 검색 (조건부)
    let context = "";
    
    // 건강 기록 관련 키워드가 있을 때만 검색
    const needsHealthRecords = /혈압|혈당|콜레스테롤|검진|기록|수치|결과|처방|진료|병원|검사/i.test(message);
    console.log(`건강 기록 검색 필요: ${needsHealthRecords}`);
    
    if (needsHealthRecords) {
      const vectorSearchStart = Date.now();

      const docs = await hybridSearch(COLLECTION_NAME, message, 3);
      console.log(`[2] 하이브리드 검색 완료: ${Date.now() - vectorSearchStart}ms (${docs.length}개 문서)`);

      context = docs
        .map((doc: { pageContent: string }) => doc.pageContent.slice(0, 500))
        .join("\n\n");
    } else {
      console.log(`[2] 벡터 검색 스킵: ${Date.now() - startTime}ms`);
    }

    // 4. 대화 기록 (최근 것만)
    const recentHistory = chatHistory.slice(-6);
    const chatHistoryText = recentHistory
      .map(msg => `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`)
      .join('\n');
    console.log(`[3] 대화 기록 준비: ${Date.now() - startTime}ms (최근 ${recentHistory.length}개)`);

    // 5. 프롬프트 템플릿
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
    console.log(`[4] 체인 생성: ${Date.now() - startTime}ms`);

    // 7. 스트리밍 시작
    const streamStart = Date.now();
    const stream = await chain.stream({ question: message });

    // 8. 응답 수집용 변수
    let fullResponse = "";
    let firstChunkTime = 0;

    // 9. ReadableStream 생성
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 스트리밍 청크 처리
          for await (const chunk of stream) {
            if (chunk) {
              if (!firstChunkTime) {
                firstChunkTime = Date.now() - streamStart;
                console.log(`[5] 첫 응답까지: ${firstChunkTime}ms`);
              }
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

          console.log(`[6] 전체 완료: ${Date.now() - startTime}ms`);
          console.log(`응답 길이: ${fullResponse.length}자`);
          console.log('=== 채팅 요청 종료 ===\n');

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
    console.log(`에러 발생: ${Date.now() - startTime}ms`);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}