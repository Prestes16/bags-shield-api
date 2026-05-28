import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findOrCreateUserByOAuth, getUserProfile } from "@/lib/auth/supabase";
import { signToken } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const frontendUrl = (process.env.FRONTEND_URL || "https://app.bagsshield.org").replace(/\/+$/, "");
  const callbackBase = (process.env.AUTH_CALLBACK_BASE || "https://api.bagsshield.org").replace(/\/+$/, "");

  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");

    if (!code) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=no_code`);
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get("bs_tw_state")?.value;
    const codeVerifier = cookieStore.get("bs_tw_verifier")?.value;
    cookieStore.delete("bs_tw_state");
    cookieStore.delete("bs_tw_verifier");

    if (state && savedState && state !== savedState) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=state_mismatch`);
    }
    if (!codeVerifier) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=no_verifier`);
    }

    // Exchange code for token (Basic auth with client_id:client_secret)
    const clientId = process.env.TWITTER_CLIENT_ID || "";
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || "";
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: `${callbackBase}/api/auth/twitter/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[auth/twitter/callback] Token exchange failed:", errText);
      return NextResponse.redirect(`${frontendUrl}/profile?error=token_exchange`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=no_access_token`);
    }

    // Get user profile
    const profileRes = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name",
      { headers: { authorization: `Bearer ${tokenData.access_token}` } }
    );
    const profileData = (await profileRes.json()) as {
      data?: { id: string; name?: string; profile_image_url?: string; username?: string };
    };
    const twitterUser = profileData.data;
    if (!twitterUser?.id) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=no_profile`);
    }

    // Find or create user
    const { userId } = await findOrCreateUserByOAuth("twitter", twitterUser.id, {
      name: twitterUser.name || twitterUser.username,
      picture: twitterUser.profile_image_url,
    });

    const userProfile = await getUserProfile(userId);
    const jwt = await signToken({
      userId,
      wallets: userProfile?.wallets ?? [],
      displayName: twitterUser.name || twitterUser.username,
      avatarUrl: twitterUser.profile_image_url,
    });

    return NextResponse.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
  } catch (e) {
    console.error("[auth/twitter/callback]", e);
    return NextResponse.redirect(`${frontendUrl}/profile?error=internal`);
  }
}
