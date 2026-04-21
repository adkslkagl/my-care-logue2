// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { AuthService } from "@/src/services/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await AuthService.login(body);

    // 성공 시 토큰과 유저 정보를 반환 (200 OK)
    return NextResponse.json(
      { message: "로그인 성공!", ...result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Login Error:", error);

    if (error.message === "INVALID_CREDENTIALS") {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 } // 401 Unauthorized
      );
    }

    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}