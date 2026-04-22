import { NextResponse } from 'next/server';
import { verifyToken } from '@/src/lib/auth';
import { EmotionService } from '@/src/services/emotionService';

export async function POST(request: Request) {
  const decoded = verifyToken(request);
  if (!decoded) {
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });
  }

  try {
    const result = await EmotionService.analyze(decoded.userId, message);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Emotion check error:', error);
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
