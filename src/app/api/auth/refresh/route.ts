// src/app/api/auth/refresh/route.ts
import { NextResponse } from "next/server";
import { AuthService } from "@/src/services/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json({ error: "리프레시 토큰이 필요합니다." }, { status: 400 });
    }

    const result = await AuthService.refresh(refreshToken);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "유효하지 않거나 만료된 리프레시 토큰입니다. 다시 로그인해주세요." },
      { status: 401 }
    );
  }

  
}