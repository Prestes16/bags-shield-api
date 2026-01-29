"use client";

import { useEffect, useState } from "react";

export type WalletType = "phantom" | "solflare" | "backpack" | "solana-mobile";

export interface DetectedWallet {
  type: WalletType;
  name: string;
  icon: string;
  installed: boolean;
  isMobile: boolean;
}

export interface WalletDetectionResult {
  detected: DetectedWallet[];
  isMobileEnvironment: boolean;
  hasMobileWallet: boolean;
}

export function useWalletDetection() {
  const [wallets, setWallets] = useState<WalletDetectionResult>({
    detected: [],
    isMobileEnvironment: false,
    hasMobileWallet: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detectWallets = () => {
      const detected: DetectedWallet[] = [];
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);

      const windowObj = window as any;

      // Phantom
      if (windowObj.phantom?.solana?.isPhantom) {
        detected.push({
          type: "phantom",
          name: "Phantom",
          icon: "🎭",
          installed: true,
          isMobile: isMobile,
        });
      }

      // Solflare
      if (windowObj.solflare) {
        detected.push({
          type: "solflare",
          name: "Solflare",
          icon: "⛱️",
          installed: true,
          isMobile: isMobile,
        });
      }

      // Backpack
      if (windowObj.backpack?.solana) {
        detected.push({
          type: "backpack",
          name: "Backpack",
          icon: "🎒",
          installed: true,
          isMobile: isMobile,
        });
      }

      // Solana Mobile Wallet Adapter (mobile-only)
      if (isMobile) {
        detected.push({
          type: "solana-mobile",
          name: "Mobile Wallet",
          icon: "📱",
          installed: true,
          isMobile: true,
        });
      }

      // If nothing detected but is mobile, show installation prompt
      if (detected.length === 0 && isMobile) {
        detected.push({
          type: "phantom",
          name: "Phantom",
          icon: "🎭",
          installed: false,
          isMobile: true,
        });
      }

      const hasMobileWallet = detected.some((w) => w.isMobile && w.installed);

      setWallets({
        detected,
        isMobileEnvironment: isMobile,
        hasMobileWallet,
      });
      setLoading(false);
    };

    // Small delay to ensure window is ready
    const timer = setTimeout(detectWallets, 100);
    return () => clearTimeout(timer);
  }, []);

  return { wallets, loading };
}
