// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { AuthService } from "@/src/services/authService";
import { verifyToken } from "@/src/lib/auth";

export async function POST(request: Request) {
  try {
    // 1. 토큰이 유효한지 먼저 확인 (누가 로그아웃하는지 알아야 하니까요)
    const decoded = verifyToken(request);

    if (!decoded) {
      return NextResponse.json(
        { error: "인증되지 않은 요청입니다. (토큰 만료 혹은 없음)" },
        { status: 401 }
      );
    }

    // 2. 서비스 레이어에서 Redis 토큰 삭제
    await AuthService.logout(decoded.userId);

    return NextResponse.json(
      { message: "로그아웃되었습니다." },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "로그아웃 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}