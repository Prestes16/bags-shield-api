import { NextRequest, NextResponse } from "next/server";

export interface FeatureFlags {
  proScanEnabled: boolean;
  proScanPriceSOL: number;
  proScanPriceLamports: number;
  jupiterSwapEnabled: boolean;
  appFeeBps: number;
  supportedWallets: string[];
  cacheEnabled: boolean;
}

const features: FeatureFlags = {
  proScanEnabled: true,
  proScanPriceSOL: 0.5,
  proScanPriceLamports: 500000000,
  jupiterSwapEnabled: true,
  appFeeBps: 25, // 0.25%
  supportedWallets: ["phantom", "solflare", "backpack", "solana-mobile"],
  cacheEnabled: true,
};

export async function GET(request: NextRequest) {
  // Cache for 5 minutes
  return NextResponse.json(features, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
