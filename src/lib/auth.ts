// src/lib/auth.ts 수정
import jwt from "jsonwebtoken";

export const verifyToken = (request: Request) => {
  const authHeader = request.headers.get("authorization");
  
  // 👇 터미널에 헤더가 어떻게 들어오는지 찍어봅시다.
  console.log("들어온 Authorization 헤더:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ 헤더가 비어있거나 Bearer로 시작하지 않습니다.");
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
      userId: number;
      email: string;
    };
    console.log("✅ 토큰 검증 성공! 유저 ID:", decoded.userId);
    return decoded;
  } catch (error: any) {
    // 만료되었으면 'jwt expired'라고 뜰 겁니다.
    console.log("❌ 토큰 검증 실패 이유:", error.message);
    return null;
  }
};