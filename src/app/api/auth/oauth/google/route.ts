import { NextResponse } from "next/server";
import { getGoogleOAuthURL } from "@/src/lib/oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientRedirectUri = searchParams.get('redirect_uri') ?? undefined;
  const url = getGoogleOAuthURL(clientRedirectUri);
  return NextResponse.redirect(url);
}