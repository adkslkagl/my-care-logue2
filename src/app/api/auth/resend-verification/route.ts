// src/app/api/auth/resend-verification/route.ts
// 사용법: POST /api/auth/resend-verification
// Authorization: Bearer <accessToken> 헤더 필요

import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { EmailService } from "@/src/services/emailService";

export async function POST(request: Request) {
  const decoded = verifyToken(request);

  if (!decoded) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      return NextResponse.json({ error: "유저를 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "이미 인증된 이메일입니다." }, { status: 200 });
    }

    await EmailService.sendVerificationEmail(user.id, user.email);
    return NextResponse.json({ message: "인증 메일을 재발송했습니다." }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "메일 발송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
