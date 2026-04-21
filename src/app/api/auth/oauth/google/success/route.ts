import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('accessToken') ?? '';
  const refreshToken = searchParams.get('refreshToken') ?? '';
  const userId = searchParams.get('userId') ?? '';
  const email = searchParams.get('email') ?? '';
  const name = searchParams.get('name') ?? '';

  const deepLink = `exp://192.168.0.65:8081/--/oauth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}&userId=${userId}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

  return NextResponse.redirect(deepLink);
}