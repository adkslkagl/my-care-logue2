// src/services/emailService.ts
import { prisma } from "@/src/lib/prisma";
import { redis } from "@/src/lib/redis";
import { transporter } from "@/src/lib/nodemailer";
import crypto from "crypto";

const EMAIL_VERIFY_TTL = 60 * 60; // 1시간 (초)

export const EmailService = {
  // 이메일 인증 토큰 생성 → DB 저장 → 메일 발송
  async sendVerificationEmail(userId: number, email: string) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL * 1000);

    // 기존 토큰 삭제 후 새로 생성
    await prisma.emailVerification.deleteMany({ where: { userId } });
    await prisma.emailVerification.create({
      data: { userId, token, expiresAt },
    });

    // Redis에도 캐싱 (빠른 조회용)
    await redis.set(`email_verify:${token}`, String(userId), "EX", EMAIL_VERIFY_TTL);

    const verifyURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "이메일 인증을 완료해주세요",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>이메일 인증</h2>
          <p>아래 버튼을 클릭하면 인증이 완료됩니다. (유효시간: 1시간)</p>
          <a href="${verifyURL}"
             style="display:inline-block;padding:12px 24px;background:#5348b7;color:#fff;border-radius:8px;text-decoration:none">
            이메일 인증하기
          </a>
          <p style="margin-top:16px;font-size:12px;color:#888">
            본인이 요청하지 않았다면 이 이메일을 무시해주세요.
          </p>
        </div>
      `,
    });

    console.log(`✅ [인증 메일 발송] ${email} 로 인증 메일을 보냈습니다.`);
  },

  // 토큰 검증 → User emailVerified = true 로 업데이트
  async verifyEmailToken(token: string) {
    // 1. Redis에서 userId 빠르게 조회
    const userId = await redis.get(`email_verify:${token}`);
    if (!userId) throw new Error("INVALID_OR_EXPIRED_TOKEN");

    // 2. DB에서도 확인 (만료 시간 검증)
    const record = await prisma.emailVerification.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw new Error("INVALID_OR_EXPIRED_TOKEN");
    }

    // 3. User 인증 완료 처리
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { emailVerified: true },
    });

    // 4. 사용한 토큰 정리
    await prisma.emailVerification.delete({ where: { token } });
    await redis.del(`email_verify:${token}`);

    console.log(`✅ [이메일 인증 완료] userId: ${userId}`);
  },
};
