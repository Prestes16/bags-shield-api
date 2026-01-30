import { NextRequest, NextResponse } from "next/server";

// Jupiter API v6 Configuration
const JUPITER_API_KEY = "99bf316b-8d0b-4b09-8b0e-9eab5cc6c162";
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

// Real Jupiter API integration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputMint, outputMint, amount, userPublicKey, isSafe, userAcceptedRisk = false } = body;

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

    // Step 1: Get quote from Jupiter
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: "50", // 0.5% slippage
      platformFeeBps: "50", // 0.5% platform fee
    });

    const quoteResponse = await fetch(`${JUPITER_QUOTE_API}?${quoteParams}`, {
      headers: {
        "Accept": "application/json",
        ...(JUPITER_API_KEY && { "Authorization": `Bearer ${JUPITER_API_KEY}` }),
      },
    });

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error("[v0] Jupiter quote failed:", errorText);
      return NextResponse.json(
        { error: "Failed to get quote", code: "QUOTE_FAILED" },
        { status: 400 }
      );
    }

    const quoteData = await quoteResponse.json();

    // Step 2: Get swap transaction from Jupiter
    const swapPayload = {
      quoteResponse: quoteData,
      userPublicKey: userPublicKey,
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: "auto",
      dynamicComputeUnitLimit: true,
    };

    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(JUPITER_API_KEY && { "Authorization": `Bearer ${JUPITER_API_KEY}` }),
      },
      body: JSON.stringify(swapPayload),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error("[v0] Jupiter swap failed:", errorText);
      return NextResponse.json(
        { error: "Failed to create swap transaction", code: "SWAP_FAILED" },
        { status: 400 }
      );
    }

    const swapData = await swapResponse.json();

    return NextResponse.json(
      {
        swapTransaction: swapData.swapTransaction,
        quote: {
          inputMint,
          outputMint,
          inAmount: quoteData.inAmount,
          outAmount: quoteData.outAmount,
          priceImpact: quoteData.priceImpactPct,
          platformFee: quoteData.platformFee?.amount || 0,
          otherAmountThreshold: quoteData.otherAmountThreshold,
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
