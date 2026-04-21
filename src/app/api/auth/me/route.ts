// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  const decoded = verifyToken(request);

  if (!decoded) {
    return NextResponse.json({ error: "인증되지 않은 사용자입니다." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, name: true, createdAt: true } // 비밀번호 빼고 가져오기
  });

  return NextResponse.json(user);
}