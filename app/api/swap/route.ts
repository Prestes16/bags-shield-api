import { NextRequest, NextResponse } from "next/server";

// Jupiter Ultra API Configuration
const JUPITER_API_KEY = "99bf316b-8d0f-4b09-8b0e-9eab5cc6c162";
const JUPITER_ULTRA_API = "https://api.jup.ag/ultra";

// Real Jupiter Ultra API integration
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

    // Step 1: Get order from Jupiter Ultra API (GET request with query params)
    const orderParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      taker: userPublicKey,
      slippageBps: "50",
    });

    const orderUrl = `${JUPITER_ULTRA_API}/v1/order?${orderParams}`;
    console.log("[v0] Fetching order from:", orderUrl);

    const orderResponse = await fetch(orderUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "x-api-key": JUPITER_API_KEY,
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("[v0] Jupiter order failed:", orderResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to get order: ${errorText}`, code: "ORDER_FAILED", details: errorText },
        { status: 400 }
      );
    }

    const orderData = await orderResponse.json();
    console.log("[v0] Order received:", { requestId: orderData.requestId, hasTransaction: !!orderData.transaction });

    // Check if transaction was returned
    if (!orderData.transaction) {
      const errorMsg = orderData.errorMessage || "No transaction returned";
      console.error("[v0] No transaction in order:", orderData.errorCode, errorMsg);
      return NextResponse.json(
        { error: errorMsg, code: "NO_TRANSACTION", details: orderData },
        { status: 400 }
      );
    }

    // Ultra API returns the order with transaction details
    return NextResponse.json(
      {
        requestId: orderData.requestId,
        transaction: orderData.transaction,
        quote: {
          inputMint: orderData.inputMint,
          outputMint: orderData.outputMint,
          inAmount: orderData.inAmount,
          outAmount: orderData.outAmount,
          priceImpact: orderData.priceImpact,
          slippageBps: orderData.slippageBps,
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
