"use client";

import { useEffect, useState } from "react";

export interface FeatureFlags {
  proScanEnabled: boolean;
  proScanPriceSOL: number;
  proScanPriceLamports: number;
  jupiterSwapEnabled: boolean;
  appFeeBps: number;
  supportedWallets: string[];
  cacheEnabled: boolean;
}

let cachedFeatures: FeatureFlags | null = null;
let cacheTime = 0;

export function useFeatureFlags() {
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        // Use cached features if still valid (5 minute TTL)
        if (cachedFeatures && Date.now() - cacheTime < 5 * 60 * 1000) {
          setFeatures(cachedFeatures);
          setLoading(false);
          return;
        }

        const response = await fetch("/api/features", {
          headers: {
            "Cache-Control": "public, max-age=300",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch feature flags");
        }

        const data = await response.json();
        cachedFeatures = data;
        cacheTime = Date.now();
        setFeatures(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Provide sensible defaults if fetch fails
        setFeatures({
          proScanEnabled: false,
          proScanPriceSOL: 0.5,
          proScanPriceLamports: 500000000,
          jupiterSwapEnabled: false,
          appFeeBps: 25,
          supportedWallets: ["phantom"],
          cacheEnabled: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  return { features, loading, error };
}
