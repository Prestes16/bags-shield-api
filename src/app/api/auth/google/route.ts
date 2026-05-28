import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callbackBase = (process.env.AUTH_CALLBACK_BASE || "https://api.bagsshield.org").replace(/\/+$/, "");
  if (!clientId) {
    console.error("[auth/google] GOOGLE_CLIENT_ID not set — OAuth disabled");
    return NextResponse.json({ success: false, error: "Google OAuth not configured" }, { status: 503 });
  }

  const nonce = crypto.randomUUID();
  const redirectUri = `${callbackBase}/api/auth/google/callback`;
  // Log for Vercel Function logs — paste this URI into Google Cloud Console
  console.log("[auth/google] redirect_uri:", redirectUri);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid email profile",
    response_type: "code",
    state: nonce,
    access_type: "offline",
    prompt: "select_account",
  });

  const cookieStore = await cookies();
  cookieStore.set("bs_oauth_state", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
