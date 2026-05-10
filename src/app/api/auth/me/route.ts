import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken } from "@/lib/auth/jwt";
import { getUserProfile } from "@/lib/auth/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": process.env.FRONTEND_URL || "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return json({ success: false, error: "NO_TOKEN", message: "Authorization header required" }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return json({ success: false, error: "INVALID_TOKEN", message: "Token expired or invalid" }, 401);
  }

  try {
    const profile = await getUserProfile(payload.userId);
    if (!profile) {
      return json({ success: false, error: "USER_NOT_FOUND" }, 404);
    }

    // Auto-renew token
    const newToken = await signToken({
      userId: profile.userId,
      wallets: profile.wallets,
      email: profile.email ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    });

    // Fetch recent scans and launches
    let recentScans: unknown[] = [];
    let launches: unknown[] = [];
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (sbUrl && sbKey) {
      const sbBase = sbUrl.replace(/\/+$/, "") + "/rest/v1";
      const sbHeaders = { apikey: sbKey, authorization: `Bearer ${sbKey}`, "content-type": "application/json" };
      try {
        const [scansRes, launchesRes] = await Promise.all([
          fetch(`${sbBase}/user_scans?user_id=eq.${profile.userId}&order=scanned_at.desc&limit=10`, { headers: sbHeaders }),
          fetch(`${sbBase}/user_launches?user_id=eq.${profile.userId}&order=created_at.desc&limit=50`, { headers: sbHeaders }),
        ]);
        if (scansRes.ok) recentScans = await scansRes.json();
        if (launchesRes.ok) launches = await launchesRes.json();
      } catch {}
    }

    return json({
      success: true,
      user: profile,
      token: newToken,
      recentScans,
      launches,
    });
  } catch (e) {
    console.error("[auth/me]", e);
    return json({ success: false, error: "INTERNAL" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
