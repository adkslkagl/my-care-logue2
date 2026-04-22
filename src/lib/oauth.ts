// src/lib/oauth.ts
const GOOGLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/google/callback`;

const ALLOWED_CLIENT_REDIRECTS = [
  /^exp:\/\//,          // Expo 개발: exp://[ip]:8081/--/oauth/callback
  /^my-care-app:\/\//, // 프로덕션 딥링크: my-care-app://oauth/callback
];

export function isAllowedRedirect(uri: string): boolean {
  return ALLOWED_CLIENT_REDIRECTS.some(pattern => pattern.test(uri));
}

export function getGoogleOAuthURL(clientRedirectUri?: string) {
  const state = clientRedirectUri && isAllowedRedirect(clientRedirectUri)
    ? Buffer.from(clientRedirectUri).toString('base64')
    : '';

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    ...(state && { state }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
  return res.json() as Promise<{ access_token: string; id_token: string }>;
}

export async function getGoogleUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("GOOGLE_USERINFO_FAILED");
  return res.json() as Promise<{ id: string; email: string; name: string }>;
}
