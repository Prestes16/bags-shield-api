import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { findOrCreateUserByWallet, getUserProfile } from "@/lib/auth/supabase";
import { signToken } from "@/lib/auth/jwt";

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

interface WalletAuthBody {
  wallet?: string;
  signature?: string;
  message?: string;
  nonce?: string;
}

export async function POST(req: NextRequest) {
  let body: WalletAuthBody;
  try {
    body = (await req.json()) as WalletAuthBody;
  } catch {
    return json({ success: false, error: "INVALID_JSON" }, 400);
  }

  const wallet = String(body.wallet ?? "").trim();
  const signatureB64 = String(body.signature ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!wallet || !signatureB64 || !message) {
    return json({ success: false, error: "MISSING_FIELDS", message: "wallet, signature, message required" }, 400);
  }

  // Verify message contains the wallet address
  if (!message.includes(wallet.slice(0, 8))) {
    return json({ success: false, error: "INVALID_MESSAGE", message: "Message must contain wallet address" }, 400);
  }

  // Verify ed25519 signature
  try {
    const pubkey = new PublicKey(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signatureB64, "base64");

    const valid = nacl.sign.detached.verify(
      messageBytes,
      new Uint8Array(signatureBytes),
      pubkey.toBytes()
    );

    if (!valid) {
      return json({ success: false, error: "INVALID_SIGNATURE", message: "Signature verification failed" }, 401);
    }
  } catch (e) {
    return json({ success: false, error: "VERIFICATION_ERROR", message: String(e) }, 400);
  }

  // Find or create user
  try {
    const { userId } = await findOrCreateUserByWallet(wallet);
    const profile = await getUserProfile(userId);

    const jwt = await signToken({
      userId,
      wallets: profile?.wallets ?? [wallet],
      displayName: profile?.displayName ?? undefined,
      email: profile?.email ?? undefined,
      avatarUrl: profile?.avatarUrl ?? undefined,
    });

    return json({
      success: true,
      token: jwt,
      userId,
      user: profile,
    });
  } catch (e) {
    console.error("[auth/wallet]", e);
    return json({ success: false, error: "INTERNAL", message: "Auth failed" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
