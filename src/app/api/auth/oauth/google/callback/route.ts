import { NextResponse } from "next/server";
import { exchangeGoogleCode, getGoogleUserInfo } from "@/src/lib/oauth";
import { OAuthService } from "@/src/services/oauthService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "인가 코드가 없습니다." }, { status: 400 });
  }

  try {
    const state = searchParams.get('state') ?? '';
    const { access_token } = await exchangeGoogleCode(code);
    const googleUser = await getGoogleUserInfo(access_token);

    const result = await OAuthService.handleOAuthLogin({
      provider: "google",
      providerAccountId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
    });

    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: String(result.user.id),
      email: result.user.email ?? '',
      name: result.user.name ?? '',
      ...(state && { state }),
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/google/success?${params}`
    );
  } catch (error: any) {
    console.error("Google OAuth Error:", error);
    return NextResponse.json({ error: "Google 로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}