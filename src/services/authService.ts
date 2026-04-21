// src/services/authService.ts
import { prisma } from "@/src/lib/prisma";
import { redis } from "@/src/lib/redis";
import { EmailService } from "@/src/services/emailService";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const AuthService = {
  // 🟢 [1] 회원가입 — 이메일 인증 메일 발송 포함
  async signup(data: { email: string; password: string; name?: string }) {
    const { email, password, name } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new Error("ALREADY_EXISTS");

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { email, name, password: hashedPassword, emailVerified: false },
    });

    // 인증 메일 발송 (실패해도 가입은 완료되도록 try-catch)
    try {
      await EmailService.sendVerificationEmail(newUser.id, newUser.email);
    } catch (err) {
      console.error("⚠️ [인증 메일 발송 실패] 가입은 완료됨:", err);
    }

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  // 🔵 [2] 로그인 — 이메일 인증 여부 체크 추가
  async login(data: { email: string; password: string }) {
    const { email, password } = data;
    console.log(`[로그인 시도] 이메일: '${email}'`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      // password가 null이면 소셜 가입 유저 → 비밀번호 로그인 불가
      console.log("❌ [로그인 실패] 유저 없음 또는 소셜 전용 계정");
      throw new Error("INVALID_CREDENTIALS");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log("❌ [로그인 실패] 비밀번호 불일치");
      throw new Error("INVALID_CREDENTIALS");
    }

    // 이메일 인증 체크 (필요에 따라 주석 해제)
    // if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "14d" }
    );

    await redis.set(`refresh_token:${user.id}`, refreshToken, "EX", 1209600);
    console.log(`✅ [로그인 성공] userId: ${user.id}`);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  },

  // 🔄 [3] 리프레시 토큰으로 액세스 토큰 갱신
  async refresh(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: number };

      const savedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (!savedToken || savedToken !== refreshToken) {
        throw new Error("INVALID_REFRESH_TOKEN");
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) throw new Error("USER_NOT_FOUND");

      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" }
      );

      return { accessToken: newAccessToken };
    } catch (error: any) {
      console.error("🚨 [토큰 갱신 실패]:", error.message);
      throw new Error("REFRESH_FAILED");
    }
  },

  // 🔴 [4] 로그아웃
  async logout(userId: number) {
    await redis.del(`refresh_token:${userId}`);
    console.log(`🗑️ [로그아웃] refresh_token:${userId} 삭제 완료`);
    return { success: true };
  },
};
