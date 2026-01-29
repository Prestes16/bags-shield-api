"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { CheckCircle, Home, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

export default function TradeConfirmationPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const tokenName = searchParams.get("tokenName") || "Token";
  const tokenSymbol = searchParams.get("tokenSymbol") || "TKN";
  const amount = searchParams.get("amount") || "1000";
  const mode = searchParams.get("mode") || "buy"; // "buy" or "sell"

  const handleViewAssets = () => {
    router.push("/");
  };

  const handleTradeAnother = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-bg-page flex flex-col items-center justify-center px-4 pb-safe">
      <div className="w-full max-w-md">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-[var(--cyan-primary)]/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_32px_rgba(16,185,129,0.3)]">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            {mode === "buy" ? "Purchase Confirmed!" : "Sale Confirmed!"}
          </h1>
          <p className="text-text-muted">
            Your transaction has been successfully completed
          </p>
        </div>

        {/* Transaction Details */}
        <div className="bg-bg-card rounded-xl p-5 border border-border-subtle mb-6 space-y-4">
          {/* Token Info */}
          <div>
            <p className="text-xs text-text-muted mb-2 uppercase font-medium">
              {mode === "buy" ? "Purchased" : "Sold"}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center">
                <span className="text-lg font-bold text-[var(--cyan-primary)]">
                  {tokenSymbol.slice(0, 1)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary">{tokenSymbol}</p>
                <p className="text-xs text-text-muted">{tokenName}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border-subtle" />

          {/* Amount */}
          <div>
            <p className="text-xs text-text-muted mb-1 uppercase font-medium">Amount</p>
            <p className="text-xl font-bold text-text-primary">{amount} {tokenSymbol}</p>
          </div>

          <div className="h-px bg-border-subtle" />

          {/* Status */}
          <div>
            <p className="text-xs text-text-muted mb-1 uppercase font-medium">Status</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Completed</span>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="bg-gradient-to-r from-[var(--cyan-primary)]/10 to-[var(--cyan-secondary)]/10 rounded-xl p-4 border border-[var(--cyan-primary)]/20 mb-6">
          <p className="text-sm text-text-secondary">
            Your {tokenSymbol} tokens are now in your wallet. You can view your portfolio in the Assets section.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleViewAssets}
            className="w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>

          <button
            type="button"
            onClick={handleTradeAnother}
            className="w-full h-12 rounded-xl font-medium text-text-secondary bg-bg-card border border-border-subtle hover:bg-bg-card-hover active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Scan Another Token
          </button>
        </div>
      </div>
    </div>
  );
}
