import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findOrCreateUserByOAuth, getUserProfile } from "@/lib/auth/supabase";
import { signToken } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const frontendUrl = process.env.FRONTEND_URL || "https://app.bagsshield.org";
  const callbackBase = process.env.AUTH_CALLBACK_BASE || "https://api.bagsshield.org";

  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");

    if (!code) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=no_code`);
    }

    // Validate state
    const cookieStore = await cookies();
    const savedState = cookieStore.get("bs_oauth_state")?.value;
    if (state && savedState && state !== savedState) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=state_mismatch`);
    }
    cookieStore.delete("bs_oauth_state");

    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${callbackBase}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=token_exchange`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${frontendUrl}/profile?error=no_access_token`);
    }

    // Get user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    // Find or create user
    const { userId } = await findOrCreateUserByOAuth("google", profile.sub, {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    const userProfile = await getUserProfile(userId);
    const jwt = await signToken({
      userId,
      wallets: userProfile?.wallets ?? [],
      email: profile.email,
      displayName: profile.name,
      avatarUrl: profile.picture,
    });

    return NextResponse.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
  } catch (e) {
    console.error("[auth/google/callback]", e);
    return NextResponse.redirect(`${frontendUrl}/profile?error=internal`);
  }
}
