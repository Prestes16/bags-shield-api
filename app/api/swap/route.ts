import { NextRequest, NextResponse } from "next/server";

// Jupiter API v6 Configuration (Public endpoints)
const JUPITER_API = "https://quote-api.jup.ag/v6";

// Jupiter API v6 integration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputMint, outputMint, amount, userPublicKey, isSafe, userAcceptedRisk = false } = body;

    console.log("[v0] Swap request:", { inputMint, outputMint, amount, userPublicKey });

    // Safety check - but allow if user explicitly accepted risk
    if (!isSafe && !userAcceptedRisk) {
      return NextResponse.json(
        {
          error: "Token failed safety checks",
          code: "UNSAFE_TOKEN",
        },
        { status: 403 }
      );
    }

    // Step 1: Get quote from Jupiter v6
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: "50",
    });

    const quoteUrl = `${JUPITER_API}/quote?${quoteParams}`;
    console.log("[v0] Fetching quote from:", quoteUrl);

    const quoteResponse = await fetch(quoteUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error("[v0] Jupiter quote failed:", quoteResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to get quote: ${errorText}`, code: "QUOTE_FAILED", details: errorText },
        { status: 400 }
      );
    }

    const quoteData = await quoteResponse.json();
    console.log("[v0] Quote received:", { inAmount: quoteData.inAmount, outAmount: quoteData.outAmount });

    // Step 2: Get swap transaction from Jupiter v6
    const swapPayload = {
      quoteResponse: quoteData,
      userPublicKey,
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: "auto",
    };

    const swapUrl = `${JUPITER_API}/swap`;
    console.log("[v0] Fetching swap transaction...");

    const swapResponse = await fetch(swapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(swapPayload),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error("[v0] Jupiter swap failed:", swapResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to create swap: ${errorText}`, code: "SWAP_FAILED", details: errorText },
        { status: 400 }
      );
    }

    const swapData = await swapResponse.json();
    console.log("[v0] Swap transaction created");

    // Return transaction and quote
    return NextResponse.json(
      {
        transaction: swapData.swapTransaction,
        quote: {
          inputMint,
          outputMint,
          inAmount: quoteData.inAmount,
          outAmount: quoteData.outAmount,
          priceImpact: quoteData.priceImpactPct,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[v0] Swap API error:", error);
    return NextResponse.json(
      { error: "Swap failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
