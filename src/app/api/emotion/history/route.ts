import { NextResponse } from 'next/server';
import { verifyToken } from '@/src/lib/auth';
import { EmotionService } from '@/src/services/emotionService';

export async function GET(request: Request) {
  const decoded = verifyToken(request);
  if (!decoded) {
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupBy = searchParams.get('groupBy');

  try {
    if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
      const data = await EmotionService.getAggregated(decoded.userId, groupBy);
      return NextResponse.json(data);
    }

    const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100);
    const data = await EmotionService.getHistory(decoded.userId, limit);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Emotion history error:', error);
    return NextResponse.json({ error: '기록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
