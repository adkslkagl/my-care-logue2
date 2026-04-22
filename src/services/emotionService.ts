import { prisma } from '@/src/lib/prisma';
import { geminiLLM } from '@/src/lib/langchain-llm';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

export type EmotionLevel = 'NORMAL' | 'CAUTION' | 'DANGER';

interface EmotionAnalysis {
  stressScore: number;
  level: EmotionLevel;
  aiResponse: string;
}

const SYSTEM_PROMPT = `당신은 요양보호사의 마음을 깊이 이해하는 공감 상담사입니다.

사용자의 감정 메시지를 분석하여 반드시 아래 JSON 형식으로만 응답하세요.

{{
  "stressScore": 0~100 사이의 정수,
  "level": "NORMAL" 또는 "CAUTION" 또는 "DANGER",
  "aiResponse": "공감 응답 + 상황별 대처 가이드"
}}

레벨 기준:
- NORMAL (0-40): 안정적. 따뜻한 공감과 긍정 강화.
- CAUTION (41-70): 주의 필요. 공감 후 구체적인 스트레스 해소법 2-3가지 안내.
- DANGER (71-100): 즉각 개입 필요. 깊은 공감 후 즉각적인 대처법 + 전문 상담 권유.

aiResponse는 150자 이내로 자연스럽고 따뜻하게 작성하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

사용자 메시지: {message}`;

function parseLevel(score: number): EmotionLevel {
  if (score <= 40) return 'NORMAL';
  if (score <= 70) return 'CAUTION';
  return 'DANGER';
}

export const EmotionService = {
  async analyze(userId: number, message: string): Promise<EmotionAnalysis> {
    const prompt = PromptTemplate.fromTemplate(SYSTEM_PROMPT);
    const chain = RunnableSequence.from([
      { message: (input: { message: string }) => input.message },
      prompt,
      geminiLLM,
      new StringOutputParser(),
    ]);

    const raw = await chain.invoke({ message });

    // JSON 파싱 (LLM이 마크다운 코드블록 감쌀 경우 대비)
    const jsonStr = raw.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const stressScore = Math.min(100, Math.max(0, Number(parsed.stressScore)));
    const level = parseLevel(stressScore);
    const aiResponse = String(parsed.aiResponse ?? '');

    await prisma.emotionLog.create({
      data: { userId, content: message, stressScore, level, aiResponse },
    });

    return { stressScore, level, aiResponse };
  },

  async getHistory(userId: number, limit = 30) {
    return prisma.emotionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        stressScore: true,
        level: true,
        aiResponse: true,
        createdAt: true,
      },
    });
  },

  async getAggregated(userId: number, groupBy: 'day' | 'week' | 'month') {
    const formatMap = {
      day:   '%Y-%m-%d',
      week:  '%Y-%u',
      month: '%Y-%m',
    };
    const fmt = formatMap[groupBy];

    const rows = await prisma.$queryRaw<
      { period: string; avgScore: number; count: bigint }[]
    >`
      SELECT
        DATE_FORMAT(createdAt, ${fmt})  AS period,
        ROUND(AVG(stressScore), 1)      AS avgScore,
        COUNT(*)                        AS count
      FROM EmotionLog
      WHERE userId = ${userId}
      GROUP BY period
      ORDER BY period DESC
      LIMIT 24
    `;

    return rows.map(r => ({
      period:   r.period,
      avgScore: Number(r.avgScore),
      count:    Number(r.count),
      level:    parseLevel(Number(r.avgScore)),
    }));
  },
};
