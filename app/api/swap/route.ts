import { NextRequest, NextResponse } from "next/server";

// Helius/Jupiter integration (mock for now)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputMint, outputMint, amount, isSafe, userAcceptedRisk = false } = body;

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

    // Mock Jupiter API response with platform fee
    // In production: Forward to Helius RPC or Jupiter API with platformFeeBps: 50
    const mockSwapTransaction = {
      transaction: "base64_encoded_transaction_placeholder",
      inputAmount: amount,
      outputAmount: Math.floor(amount * 0.95), // Mock 5% slippage
      platformFee: Math.floor(amount * 0.005), // 50 bps = 0.5%
      estimatedGas: 5000,
    };

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    return NextResponse.json(
      {
        swapTransaction: mockSwapTransaction,
        quote: {
          inputMint,
          outputMint,
          inAmount: amount,
          outAmount: mockSwapTransaction.outputAmount,
          priceImpact: 0.5,
          platformFee: mockSwapTransaction.platformFee,
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
