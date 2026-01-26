"use client";

import { CheckCircle2, Download } from "lucide-react";
import type { DetectedWallet } from "@/hooks/use-wallet-detection";
import { useWallet } from "@/lib/wallet/wallet-context";

interface WalletDetectedCardProps {
  wallets: DetectedWallet[];
  isConnected: boolean;
  onConnect: () => Promise<boolean>;
  connecting: boolean;
}

export function WalletDetectedCard({
  wallets,
  isConnected,
  onConnect,
  connecting,
}: WalletDetectedCardProps) {
  if (wallets.length === 0) return null;

  return (
    <div className="w-full p-4 bg-gradient-to-br from-[var(--cyan-primary)]/10 to-[var(--cyan-secondary)]/10 border border-[var(--cyan-primary)]/30 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {isConnected ? "Wallet Connected" : "Connect Wallet"}
        </h3>
        {isConnected && (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        )}
      </div>

      <div className="space-y-2">
        {wallets.map((wallet) => (
          <button
            key={wallet.type}
            onClick={onConnect}
            disabled={connecting || !wallet.installed}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
              wallet.installed
                ? "bg-bg-card-hover border-border-subtle hover:border-[var(--cyan-primary)]/50 active:scale-98"
                : "bg-bg-card/50 border-border-subtle/30 opacity-60 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xl">{wallet.icon}</span>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">
                  {wallet.name}
                </p>
                {wallet.isMobile && (
                  <p className="text-xs text-text-muted">Mobile</p>
                )}
              </div>
            </div>

            {!wallet.installed ? (
              <Download className="w-4 h-4 text-text-muted" />
            ) : (
              <svg
                className={`w-5 h-5 ${
                  connecting
                    ? "animate-spin text-[var(--cyan-primary)]"
                    : "text-text-muted"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>

      {wallets.some((w) => !w.installed) && (
        <p className="text-xs text-text-muted mt-3 px-1">
          Install a wallet to connect and trade. Phantom is recommended for
          mobile.
        </p>
      )}
    </div>
  );
}
