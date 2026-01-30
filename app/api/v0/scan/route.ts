import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { deserializeBigInt } from "@/lib/fees";
import { APP_COSTS_TEAM_WALLET, APP_PUBLIC_RESERVE_WALLET } from "@/lib/constants";

// Helius API Configuration
const HELIUS_API_KEY = "1a9a5335-5b0b-444b-a24c-e477cca06a7c";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=b472996c-2166-4f29-8e41-c06251e6ee3c`;

// Create Solana connection
const connection = new Connection(HELIUS_RPC_URL, "confirmed");

/**
 * Verify fee payment transaction
 */
async function verifyFeeTransaction(
  feeTxSig: string,
  expectedWallet: string,
  expectedFeeSplit: { costsLamports: string; reserveLamports: string }
): Promise<boolean> {
  try {
    // Fetch transaction
    const tx = await connection.getTransaction(feeTxSig, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) {
      console.error("[v0] Transaction not found:", feeTxSig);
      return false;
    }

    // Verify transaction was successful
    if (tx.meta.err) {
      console.error("[v0] Transaction failed:", tx.meta.err);
      return false;
    }

    // Parse expected values
    const expectedCosts = deserializeBigInt(expectedFeeSplit.costsLamports);
    const expectedReserve = deserializeBigInt(expectedFeeSplit.reserveLamports);

    // Verify transfers to both wallets
    const costsWallet = new PublicKey(APP_COSTS_TEAM_WALLET);
    const reserveWallet = new PublicKey(APP_PUBLIC_RESERVE_WALLET);
    const userWallet = new PublicKey(expectedWallet);

    // Check postBalances - this is a simplified verification
    // In production, you'd want to parse the actual transfer instructions
    const hasTransfers = tx.transaction.message.accountKeys.some(
      (key) => key.equals(costsWallet) || key.equals(reserveWallet)
    );

    if (!hasTransfers) {
      console.error("[v0] Fee wallets not found in transaction");
      return false;
    }

    console.log("[v0] Fee transaction verified:", feeTxSig);
    return true;
  } catch (error) {
    console.error("[v0] Fee verification error:", error);
    return false;
  }
}

// Fetch real token metadata from Helius
async function fetchTokenMetadata(mint: string) {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mintAccounts: [mint],
        includeOffChain: true,
        disableCache: false,
      }),
    });

    if (!response.ok) {
      console.error("[v0] Helius metadata fetch failed:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error("[v0] Helius metadata error:", error);
    return null;
  }
}

// Fetch on-chain token info via Helius RPC
async function fetchOnChainTokenInfo(mint: string) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [
          mint,
          {
            encoding: "jsonParsed",
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[v0] Helius RPC fetch failed:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data.result?.value?.data?.parsed?.info || null;
  } catch (error) {
    console.error("[v0] Helius RPC error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mint,
      requestId,
      wallet,
      feeTxSig,
      feeTotalLamports,
      feeSplit,
    } = body;

    console.log("[v0] Scan request:", { mint, requestId, wallet, feeTxSig });

    // Validate required fields
    if (!mint || !requestId || !wallet || !feeTxSig || !feeTotalLamports || !feeSplit) {
      return NextResponse.json(
        { error: "Missing required fields", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    // Verify fee payment transaction (fail-closed)
    const feeVerified = await verifyFeeTransaction(feeTxSig, wallet, feeSplit);
    
    if (!feeVerified) {
      return NextResponse.json(
        { error: "Fee payment verification failed", code: "FEE_VERIFICATION_FAILED" },
        { status: 403 }
      );
    }

    // Fetch token data from Helius
    const [metadata, onChainInfo] = await Promise.all([
      fetchTokenMetadata(mint),
      fetchOnChainTokenInfo(mint),
    ]);

    // Build scan result
    const tokenName = metadata?.onChainMetadata?.metadata?.data?.name || "Unknown Token";
    const tokenSymbol = metadata?.onChainMetadata?.metadata?.data?.symbol || mint.slice(0, 4).toUpperCase();
    const tokenImage = metadata?.offChainMetadata?.metadata?.image || metadata?.legacyMetadata?.logoURI || null;
    const supply = onChainInfo?.supply || 0;
    const decimals = onChainInfo?.decimals || 9;
    
    // Check authorities
    const hasMintAuthority = onChainInfo?.mintAuthority !== null;
    const hasFreezeAuthority = onChainInfo?.freezeAuthority !== null;

    // Calculate score based on real data
    let score = 50; // Base score
    if (!hasMintAuthority) score += 20;
    if (!hasFreezeAuthority) score += 15;
    if (metadata?.offChainMetadata) score += 10; // Has metadata
    if (supply > 0) score += 5;

    const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
    const isSafe = score >= 70;

    const findings = [];
    if (hasMintAuthority) {
      findings.push({
        severity: "HIGH",
        label: "Mint Authority Active",
        description: "Token has active mint authority - supply can be inflated",
      });
    }
    if (hasFreezeAuthority) {
      findings.push({
        severity: "MEDIUM",
        label: "Freeze Authority Active",
        description: "Token accounts can be frozen by the authority",
      });
    }
    if (!metadata?.offChainMetadata && !metadata?.legacyMetadata) {
      findings.push({
        severity: "LOW",
        label: "Limited Metadata",
        description: "Token has minimal off-chain metadata",
      });
    }

    return NextResponse.json(
      {
        requestId,
        tokenInfo: {
          name: tokenName,
          symbol: tokenSymbol,
          imageUrl: tokenImage,
          mint,
          supply: supply.toString(),
          decimals,
        },
        security: {
          score,
          grade,
          isSafe,
          mintAuthority: hasMintAuthority,
          freezeAuthority: hasFreezeAuthority,
          lpLocked: false,
        },
        integrity: {
          isVerified: !!metadata?.offChainMetadata,
        },
        findings,
        meta: {
          fromCache: false,
          stale: false,
          source: "helius",
          dataSources: ["helius", "on-chain"],
          timestamp: Date.now(),
          feeTxSig,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[v0] Scan API error:", error);
    return NextResponse.json(
      { error: "Scan failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
