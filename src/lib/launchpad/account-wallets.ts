/**
 * Account / linked-wallet resolution for Launchpad fee-claim routes.
 *
 * Resolves the authenticated Bags Shield account from the request JWT and returns
 * the wallets LINKED to that account (table `linked_wallets`). Authorization is by
 * `userId + linked wallet`: the user may sign in with Google, X or Wallet -- the
 * login method does not matter; only the JWT-resolved userId and its linked
 * wallets do. The DB currently stores linkage only (no verified/status column), so
 * this returns "linked wallets", not "verified" wallets. Never logs the token/JWT.
 */

import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getUserProfile } from "@/lib/auth/supabase";
import { BAGS_SHIELD_FEE_SHARE_WALLET } from "@/lib/launchpad/fees";

/**
 * Whether the linked-wallet account binding is enforced. Default false for
 * internal/test; set LAUNCHPAD_REQUIRE_LINKED_WALLET=true for public.
 */
export function isLinkedWalletRequired(): boolean {
  const value = (process.env.LAUNCHPAD_REQUIRE_LINKED_WALLET || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export interface AccountWalletsResult {
  /** A valid JWT session was present and verified. */
  authenticated: boolean;
  /** Short machine-readable reason (no_session | invalid_session | session_verify_error | profile_lookup_error | ok). */
  reason: string;
  userId?: string;
  /** Wallets linked to the account (normalized, deduped, Bags Shield treasury excluded). */
  wallets: string[];
}

/**
 * Read the Bearer JWT, verify it, and load the wallets linked to the account.
 * The Bags Shield treasury/partner wallet is filtered out so it can never be
 * claimed through the public user flow. Returned wallets are trimmed, non-empty
 * and deduplicated.
 */
export async function resolveAccountWallets(req: NextRequest): Promise<AccountWalletsResult> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { authenticated: false, reason: "no_session", wallets: [] };

  let payload: { userId: string } | null;
  try {
    payload = await verifyToken(token);
  } catch {
    return { authenticated: false, reason: "session_verify_error", wallets: [] };
  }
  if (!payload?.userId) return { authenticated: false, reason: "invalid_session", wallets: [] };

  let profile: Awaited<ReturnType<typeof getUserProfile>> = null;
  try {
    profile = await getUserProfile(payload.userId);
  } catch {
    return { authenticated: true, reason: "profile_lookup_error", userId: payload.userId, wallets: [] };
  }

  const treasury = String(BAGS_SHIELD_FEE_SHARE_WALLET).trim();
  const wallets = [
    ...new Set(
      (profile?.wallets ?? [])
        .map((w) => String(w ?? "").trim())
        .filter((w) => w.length > 0 && w !== treasury),
    ),
  ];
  return { authenticated: true, reason: "ok", userId: payload.userId, wallets };
}

/** Truncated, log-safe user id (never the full id). */
export function userIdPartial(userId?: string): string | null {
  return userId ? `${userId.slice(0, 8)}...` : null;
}
