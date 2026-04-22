import { NextResponse } from "next/server";
import { isAllowedRedirect } from "@/src/lib/oauth";

const FALLBACK_REDIRECT = 'my-care-app://oauth/callback';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('accessToken') ?? '';
  const refreshToken = searchParams.get('refreshToken') ?? '';
  const userId = searchParams.get('userId') ?? '';
  const email = searchParams.get('email') ?? '';
  const name = searchParams.get('name') ?? '';
  const state = searchParams.get('state') ?? '';

  let clientRedirectBase = FALLBACK_REDIRECT;
  if (state) {
    try {
      const decoded = Buffer.from(state, 'base64').toString('utf-8');
      if (isAllowedRedirect(decoded)) clientRedirectBase = decoded;
    } catch {
      // state 파싱 실패 시 fallback 사용
    }
  }

  const deepLink = `${clientRedirectBase}?accessToken=${accessToken}&refreshToken=${refreshToken}&userId=${userId}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

  return NextResponse.redirect(deepLink);
}