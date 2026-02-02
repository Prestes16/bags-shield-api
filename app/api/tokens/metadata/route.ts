import { NextResponse } from "next/server";
import { heliusClient } from "@/lib/helius-client";

export async function POST(request: Request) {
  try {
    const { mint } = await request.json();

    if (!mint || typeof mint !== "string") {
      return NextResponse.json(
        { error: "Invalid mint address" },
        { status: 400 }
      );
    }

    // Fetch metadata and price
    const { metadata, price } = await heliusClient.getTokenInfo(mint);

    if (!metadata) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      image: metadata.image,
      description: metadata.description,
      price: price?.price || 0,
      priceChange24h: price?.priceChange24h || 0,
      volume24h: price?.volume24h || 0,
      liquidity: price?.liquidity || 0,
    });
  } catch (error) {
    console.error("[v0] Error fetching token metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch token metadata" },
      { status: 500 }
    );
  }
}
