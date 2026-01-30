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

    // Step 1: Create order with Jupiter Ultra API
    const orderPayload = {
      user: userPublicKey,
      inputMint,
      outputMint,
      inputAmount: amount.toString(),
      slippageBps: 50, // 0.5% slippage
    };

    console.log("[v0] Creating order:", orderPayload);

    const orderResponse = await fetch(`${JUPITER_ULTRA_API}/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${JUPITER_API_KEY}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("[v0] Jupiter order creation failed:", orderResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to create order: ${errorText}`, code: "ORDER_FAILED", details: errorText },
        { status: 400 }
      );
    }

    const orderData = await orderResponse.json();
    console.log("[v0] Order created:", orderData);

    // Ultra API returns the order with transaction details
    return NextResponse.json(
      {
        orderId: orderData.orderId,
        transaction: orderData.transaction,
        quote: {
          inputMint,
          outputMint,
          inAmount: orderData.inputAmount,
          outAmount: orderData.outputAmount,
          priceImpact: orderData.priceImpact,
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
