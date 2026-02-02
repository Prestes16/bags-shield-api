import { NextResponse } from "next/server";
import { heliusClient } from "@/lib/helius-client";

export async function POST(request: Request) {
  try {
    const { mints } = await request.json();

    if (!mints || !Array.isArray(mints) || mints.length === 0) {
      return NextResponse.json(
        { error: "Invalid mints array" },
        { status: 400 }
      );
    }

    // Fetch batch prices from Jupiter via Helius client
    const pricesMap = await heliusClient.getBatchTokenPrices(mints);

    // Convert Map to object for JSON response
    const pricesObject: Record<string, { price: number; priceChange24h: number }> = {};
    
    for (const [mint, priceData] of pricesMap.entries()) {
      pricesObject[mint] = {
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
      };
    }

    return NextResponse.json(pricesObject);
  } catch (error) {
    console.error("[v0] Error fetching token prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch token prices" },
      { status: 500 }
    );
  }
}
