import { GoogleGenerativeAI } from "@google/generative-ai";
import { redis } from "@/src/lib/redis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `당신은 요양보호사를 위한 전문 AI 상담사입니다.
요양보호사들이 겪는 어려움을 깊이 이해하고 다음 두 가지 역할을 합니다.

1. 심리상담 / 감정지원
- 요양보호사의 감정을 공감하고 정서적 지지를 제공합니다
- 번아웃, 스트레스, 감정노동으로 인한 어려움을 따뜻하게 들어줍니다
- 필요시 전문 상담기관을 안내합니다

2. 업무 가이드 / 케어 방법
- 치매, 뇌졸중, 낙상 등 어르신 케어 방법을 안내합니다
- 욕창 예방, 이동 보조, 식사 케어 등 실무 지식을 제공합니다
- 보호자/가족과의 소통 방법을 안내합니다
- 요양보호사 관련 법적 권리와 제도를 안내합니다

항상 따뜻하고 공감적인 태도로 응답하세요.
전문적인 의료 진단은 하지 않으며 필요시 전문가 상담을 권유합니다.`;

const HISTORY_TTL = 60 * 60 * 24;
const MAX_HISTORY = 20;

export const ChatService = {
  async getHistory(userId: number) {
    const raw = await redis.get(`chat_history:${userId}`);
    if (!raw) return [];
    return JSON.parse(raw) as { role: 'user' | 'model'; parts: { text: string }[] }[];
  },

  async saveHistory(userId: number, history: any[]) {
    const trimmed = history.slice(-MAX_HISTORY);
    await redis.set(`chat_history:${userId}`, JSON.stringify(trimmed), 'EX', HISTORY_TTL);
  },

  async clearHistory(userId: number) {
    await redis.del(`chat_history:${userId}`);
  },

  async streamChat(userId: number, message: string, onChunk: (text: string) => void) {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // ✅ 수정
      systemInstruction: SYSTEM_PROMPT,
    });

    const history = await ChatService.getHistory(userId);
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(message);

    let fullResponse = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullResponse += text;
      onChunk(text);
    }

    const updatedHistory = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: fullResponse }] },
    ];
    await ChatService.saveHistory(userId, updatedHistory);

    return fullResponse;
  },
};