// src/app/api/auth/verify-email/route.ts
// 사용법: GET /api/auth/verify-email?token=<토큰>
// 인증 메일의 링크를 클릭하면 이 엔드포인트로 요청이 옵니다.

import { NextResponse } from "next/server";
import { EmailService } from "@/src/services/emailService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "토큰이 없습니다." }, { status: 400 });
  }

  try {
    await EmailService.verifyEmailToken(token);
    return NextResponse.json({ message: "이메일 인증이 완료되었습니다!" }, { status: 200 });
  } catch (error: any) {
    if (error.message === "INVALID_OR_EXPIRED_TOKEN") {
      return NextResponse.json(
        { error: "유효하지 않거나 만료된 인증 링크입니다. 재발송을 요청해주세요." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}
