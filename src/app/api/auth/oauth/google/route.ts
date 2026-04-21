import { NextResponse } from "next/server";
import { getGoogleOAuthURL } from "@/src/lib/oauth";

export async function GET() {
  const url = getGoogleOAuthURL();
  return NextResponse.redirect(url);
}