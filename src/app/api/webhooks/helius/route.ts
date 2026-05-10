import { NextRequest, NextResponse } from "next/server";
import {
  detectPoolForMint,
  updateLpLockStatus,
} from "@/lib/lp-lock/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Program IDs to monitor for pool creation
const MONITORED_PROGRAMS = new Set([
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpools
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", // Meteora DLMM
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM v4
]);

function supabaseHeaders(): Record<string, string> | null {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

/**
 * Helius Enhanced Webhook handler.
 * Helius sends an array of transaction notifications via POST.
 * We check if any interacts with Orca/Meteora/Raydium programs,
 * extract token mints, and check if we have a launch awaiting a pool.
 */
export async function POST(req: NextRequest) {
  // 1. Verify webhook secret
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}` && auth !== secret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  // 2. Parse body
  let transactions: Array<Record<string, unknown>>;
  try {
    const body = await req.json();
    transactions = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ ok: true }); // ack even on parse failure
  }

  // 3. Process in background — always return 200 quickly (Helius retries on failure)
  const supabase = supabaseHeaders();
  const supabaseBase = process.env.SUPABASE_URL
    ? `${process.env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`
    : null;

  (async () => {
    try {
      // Collect mints from DEX interactions
      const candidateMints = new Set<string>();

      for (const tx of transactions) {
        // Helius enhanced tx format: accountData, instructions, tokenTransfers, etc.
        const instructions = (tx.instructions ?? []) as Array<{
          programId?: string;
          accounts?: string[];
        }>;
        const innerInstructions = (tx.innerInstructions ?? []) as Array<{
          instructions?: Array<{ programId?: string; accounts?: string[] }>;
        }>;

        // Check outer instructions
        for (const ix of instructions) {
          if (ix.programId && MONITORED_PROGRAMS.has(ix.programId)) {
            // All accounts in the instruction could be token mints
            for (const acc of ix.accounts ?? []) {
              candidateMints.add(acc);
            }
          }
        }

        // Check inner instructions
        for (const inner of innerInstructions) {
          for (const ix of inner.instructions ?? []) {
            if (ix.programId && MONITORED_PROGRAMS.has(ix.programId)) {
              for (const acc of ix.accounts ?? []) {
                candidateMints.add(acc);
              }
            }
          }
        }

        // Also check tokenTransfers for mints
        const tokenTransfers = (tx.tokenTransfers ?? []) as Array<{
          mint?: string;
        }>;
        for (const tt of tokenTransfers) {
          if (tt.mint) candidateMints.add(tt.mint);
        }
      }

      if (candidateMints.size === 0 || !supabase || !supabaseBase) return;

      // 4. Check which mints are in our launches table with awaiting_pool status
      for (const mint of candidateMints) {
        try {
          // Check lp_lock_status table
          const res = await fetch(
            `${supabaseBase}/lp_lock_status?mint=eq.${mint}&status=eq.awaiting_pool&limit=1`,
            { headers: supabase }
          );
          if (!res.ok) continue;
          const rows = (await res.json()) as Array<Record<string, unknown>>;
          if (rows.length === 0) continue;

          // 5. Pool detected! Try to find details
          const pool = await detectPoolForMint(mint);
          if (pool) {
            await updateLpLockStatus(mint, "pool_detected", {
              poolAddress: pool.poolAddress,
              poolType: pool.poolType,
              lockedLiquidityUsd: pool.liquidityUsd,
            });
            console.log(
              `[webhook/helius] Pool detected for ${mint}: ${pool.poolType} @ ${pool.poolAddress}`
            );
          }
        } catch (e) {
          console.warn(`[webhook/helius] Error processing mint ${mint}:`, e);
        }
      }
    } catch (e) {
      console.error("[webhook/helius] Background processing error:", e);
    }
  })();

  // Always 200
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Helius webhook endpoint. Send POST to trigger.",
  });
}
