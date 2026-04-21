// src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { AuthService } from "@/src/services/authService";

export async function POST(request: Request) {
  try {
    // 1. 요청 바디에서 데이터 꺼내기
    const body = await request.json();

    // 2. 서비스 레이어의 signup 함수 호출
    const newUser = await AuthService.signup(body);

    // 3. 성공 응답 (201 Created)
    return NextResponse.json(
      { message: "회원가입이 완료되었습니다.", user: newUser },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup Error:", error);

    // 4. 에러 핸들링
    if (error.message === "ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 } // 409 Conflict
      );
    }

    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}