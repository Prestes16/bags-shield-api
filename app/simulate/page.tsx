"use client";

import { useState, useEffect } from "react";
import { TradeSimulator } from "@/components/bags-shield/trade-simulator";

export default function SimulatePage() {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading token data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <TradeSimulator
      isLoading={isLoading}
      token={{
        name: "BONK",
        symbol: "BONK",
        logoUrl: "/images/bags-token-icon.jpg",
        pair: "BONK/SOL",
      }}
    />
  );
}
