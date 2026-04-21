// src/services/oauthService.ts
import { prisma } from "@/src/lib/prisma";
import { redis } from "@/src/lib/redis";
import jwt from "jsonwebtoken";

interface OAuthProfile {
  provider: "google" | "kakao";
  providerAccountId: string;
  email?: string;
  name?: string;
}

export const OAuthService = {
  async handleOAuthLogin(profile: OAuthProfile) {
    const { provider, providerAccountId, email, name } = profile;

    // 1. 이미 연결된 Account가 있는지 확인
    let account = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });

    let user = account?.user;

    if (!user) {
      // 2. 같은 이메일의 기존 유저가 있는지 확인 (이메일로 가입한 유저)
      if (email) {
        user = await prisma.user.findUnique({ where: { email } }) ?? undefined;
      }

      // 3. 유저가 없으면 신규 생성
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: email ?? `${provider}_${providerAccountId}@no-email.local`,
            name,
            emailVerified: !!email, // 소셜 로그인은 이메일이 있으면 인증된 것으로 간주
          },
        });
        console.log(`✅ [OAuth 신규 유저] ${provider} 로 새 유저 생성 (id: ${user.id})`);
      }

      // 4. Account 연결
      await prisma.account.create({
        data: { userId: user.id, provider, providerAccountId },
      });
      console.log(`✅ [Account 연결] ${provider} 계정을 userId ${user.id} 에 연결했습니다.`);
    }

    // 5. JWT 발급 (기존 login과 동일한 구조)
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
    console.log(`✅ [OAuth 로그인 완료] userId: ${user.id} / provider: ${provider}`);

    const { password: _, ...userWithoutPassword } = user as any;
    return { user: userWithoutPassword, accessToken, refreshToken };
  },
};
