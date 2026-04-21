import { verifyToken } from "@/src/lib/auth";
import { ChatService } from "@/src/services/chatService";

export async function POST(request: Request) {
  // 로그인 체크
  const decoded = verifyToken(request);
  if (!decoded) {
    return new Response(JSON.stringify({ error: "인증되지 않은 사용자입니다." }), { status: 401 });
  }

  const { message } = await request.json();
  if (!message) {
    return new Response(JSON.stringify({ error: "메시지가 없습니다." }), { status: 400 });
  }

  // SSE 스트리밍 응답
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await ChatService.streamChat(decoded.userId, message, (chunk) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        });
        // 스트리밍 완료 신호
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      } catch (error) {
        console.error('Chat Error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '오류가 발생했습니다.' })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// 대화 히스토리 초기화
export async function DELETE(request: Request) {
  const decoded = verifyToken(request);
  if (!decoded) {
    return new Response(JSON.stringify({ error: "인증되지 않은 사용자입니다." }), { status: 401 });
  }

  await ChatService.clearHistory(decoded.userId);
  return new Response(JSON.stringify({ message: "대화 기록이 초기화되었습니다." }), { status: 200 });
}