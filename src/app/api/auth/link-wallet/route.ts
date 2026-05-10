import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { verifyToken } from "@/lib/auth/jwt";
import { linkWalletToUser } from "@/lib/auth/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": process.env.FRONTEND_URL || "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ success: false, error: "NO_TOKEN" }, 401);

  const payload = await verifyToken(token);
  if (!payload) return json({ success: false, error: "INVALID_TOKEN" }, 401);

  let body: { wallet?: string; signature?: string; message?: string };
  try {
    body = (await req.json()) as { wallet?: string; signature?: string; message?: string };
  } catch {
    return json({ success: false, error: "INVALID_JSON" }, 400);
  }

  const wallet = String(body.wallet ?? "").trim();
  const signatureB64 = String(body.signature ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!wallet || !signatureB64 || !message) {
    return json({ success: false, error: "MISSING_FIELDS" }, 400);
  }

  // Verify signature
  try {
    const pubkey = new PublicKey(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signatureB64, "base64");
    const valid = nacl.sign.detached.verify(messageBytes, new Uint8Array(signatureBytes), pubkey.toBytes());
    if (!valid) return json({ success: false, error: "INVALID_SIGNATURE" }, 401);
  } catch {
    return json({ success: false, error: "VERIFICATION_ERROR" }, 400);
  }

  try {
    await linkWalletToUser(payload.userId, wallet);
    return json({ success: true, message: "Wallet linked", wallet });
  } catch (e) {
    console.error("[auth/link-wallet]", e);
    return json({ success: false, error: "INTERNAL" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
