import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function base64url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function GET() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const callbackBase = (process.env.AUTH_CALLBACK_BASE || "https://api.bagsshield.org").replace(/\/+$/, "");
  if (!clientId) {
    console.error("[auth/twitter] TWITTER_CLIENT_ID not set — OAuth disabled");
    return NextResponse.json({ success: false, error: "Twitter OAuth not configured" }, { status: 503 });
  }

  // PKCE
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64url(verifierBytes);
  const challengeHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );
  const codeChallenge = base64url(new Uint8Array(challengeHash));

  const state = crypto.randomUUID();
  const redirectUri = `${callbackBase}/api/auth/twitter/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const cookieStore = await cookies();
  cookieStore.set("bs_tw_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("bs_tw_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
}
