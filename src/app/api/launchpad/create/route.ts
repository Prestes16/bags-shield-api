import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

const SIMULATED_MINT = "SIMULATED1111111111111111111111111111111111";

interface CreateBody {
  name?: string;
  symbol?: string;
  imageUrl?: string | null;
  image?: string | null;
  trustLayers?: Record<string, boolean>;
  lpDuration?: number;
  slippageBps?: number;
  tip?: number | null;
  wallet?: string;
}

export async function POST(req: NextRequest) {
  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return jsonNoStore(
      { success: false, error: "INVALID_JSON", message: "Body must be valid JSON" },
      400
    );
  }

  const name = String(body?.name || "").trim();
  const symbol = String(body?.symbol || "").trim().toUpperCase();

  if (!name || name.length < 2 || name.length > 32) {
    return jsonNoStore(
      { success: false, error: "INVALID_INPUT", message: "Token name must be 2-32 chars" },
      400
    );
  }
  if (!symbol || symbol.length < 2 || symbol.length > 10) {
    return jsonNoStore(
      { success: false, error: "INVALID_INPUT", message: "Symbol must be 2-10 chars" },
      400
    );
  }

  // Best-effort persistence to Supabase (table: launches). Skip silently if not configured.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/launches`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({
          name,
          symbol,
          image_url: body?.imageUrl ?? body?.image ?? null,
          trust_layers: body?.trustLayers ?? null,
          lp_duration: body?.lpDuration ?? null,
          slippage_bps: body?.slippageBps ?? null,
          tip: body?.tip ?? null,
          wallet: body?.wallet ?? null,
          status: "scheduled",
          simulated: true,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      // Persistence failure is non-fatal in mock mode
      console.warn("[launchpad/create] Supabase persist failed:", e);
    }
  }

  return jsonNoStore({
    success: true,
    response: {
      mint: SIMULATED_MINT,
      txSignature: null,
      simulated: true,
      message:
        "Token scheduled for launch. On-chain deployment will run once the launch worker is enabled.",
      submitted: {
        name,
        symbol,
        imageUrl: body?.imageUrl ?? body?.image ?? null,
        trustLayers: body?.trustLayers ?? null,
        lpDuration: body?.lpDuration ?? null,
      },
    },
    // Top-level mirrors for clients that read flat fields
    mint: SIMULATED_MINT,
    txSignature: null,
    message: "Token scheduled for launch",
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function GET() {
  return jsonNoStore(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "Use POST to create a launch",
      allowed: ["POST", "OPTIONS"],
    },
    405
  );
}
