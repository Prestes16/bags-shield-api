import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import { getClaimablePositions } from "@/lib/launchpad/bags-client";
import { resolveAccountWallets, isLinkedWalletRequired, userIdPartial } from "@/lib/launchpad/account-wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/fee-claims/positions";

function isValidPublicKey(value: string) {
  try {
    new PublicKey(value);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  } catch {
    return false;
  }
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["GET"]);
}

export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const queryWallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? "";

  // Public/strict: bind positions to the authenticated account's linked wallets.
  if (isLinkedWalletRequired()) {
    const account = await resolveAccountWallets(req);
    if (!account.authenticated) {
      SafeLogger.warn("Fee-claims positions: auth required", {
        requestId,
        endpoint: ROUTE,
        reason: account.reason,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "LINKED_WALLET_AUTH_REQUIRED",
            message: "Sign in to your Bags Shield account to view fee positions.",
          },
          meta: { requestId },
        },
        { status: 401 },
      );
    }

    let walletsChecked: string[];
    if (queryWallet) {
      if (!isValidPublicKey(queryWallet)) {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: { code: "INVALID_WALLET", message: "wallet query param must be a valid Solana public key" },
            meta: { requestId },
          },
          { status: 400 },
        );
      }
      if (!account.wallets.includes(queryWallet)) {
        SafeLogger.warn("Fee-claims positions: wallet not linked", {
          requestId,
          endpoint: ROUTE,
          userIdPartial: userIdPartial(account.userId),
          reason: "wallet_not_linked",
        });
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: {
              code: "WALLET_NOT_LINKED_TO_ACCOUNT",
              message: "This wallet is not linked to your Bags Shield account.",
            },
            meta: { requestId },
          },
          { status: 403 },
        );
      }
      walletsChecked = [queryWallet];
    } else {
      walletsChecked = account.wallets;
    }

    const positions: unknown[] = [];
    for (const linkedWallet of walletsChecked) {
      const positionsResult = await getClaimablePositions(linkedWallet);
      if ("error" in positionsResult) {
        SafeLogger.warn("Fee-claims positions: upstream error", {
          requestId,
          endpoint: ROUTE,
          errorCode: positionsResult.error.code,
        });
        continue;
      }
      if (Array.isArray(positionsResult.response)) {
        positions.push(...positionsResult.response);
      }
    }

    return jsonResponse(req, requestId, {
      success: true,
      response: {
        userIdPartial: userIdPartial(account.userId),
        walletsChecked,
        positions,
      },
      meta: { requestId, upstream: "bags" },
    });
  }

  // Internal/test (LAUNCHPAD_REQUIRE_LINKED_WALLET unset): legacy single-wallet path.
  if (!queryWallet || !isValidPublicKey(queryWallet)) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INVALID_WALLET", message: "wallet query param must be a valid Solana public key" },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const result = await getClaimablePositions(queryWallet);

  if ("error" in result) {
    SafeLogger.error("Bags claimable positions request failed", undefined, {
      requestId,
      endpoint: ROUTE,
      errorCode: result.error.code,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: result.error.code, message: result.error.message },
        meta: { requestId, upstream: "bags" },
      },
      { status: result.error.code === "BAGS_NOT_CONFIGURED" ? 503 : 502 },
    );
  }

  return jsonResponse(req, requestId, {
    success: true,
    response: {
      wallet: queryWallet,
      positions: Array.isArray(result.response) ? result.response : [],
    },
    meta: { requestId, upstream: "bags" },
  });
}
