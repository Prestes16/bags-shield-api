"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpDown, AlertTriangle, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import { useWallet } from "@/lib/wallet/wallet-context";
import { ShieldAlert } from "lucide-react"; // Import ShieldAlert

interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  logoUrl?: string;
  score?: number;
  grade?: string;
}

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenData: TokenData;
}

export function TradeModal({ isOpen, onClose, tokenData }: TradeModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { connected, publicKey, connect } = useWallet();
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [venue, setVenue] = useState<"jupiter" | "raydium">("jupiter"); // Declare venue state
  const [scanStatus, setScanStatus] = useState<"not_scanned" | "stale" | "high_risk" | "scanned">("scanned"); // Declare scanStatus state
  const [canTrade, setCanTrade] = useState<boolean>(true); // Declare canTrade state

  const tokenImage = tokenData.logoUrl; // Declare tokenImage variable
  const tokenSymbol = tokenData.symbol; // Declare tokenSymbol variable
  const tokenName = tokenData.name; // Declare tokenName variable

  const onScanRequired = () => {
    // Placeholder for scan required logic
    console.log("Scan required");
  };

  if (!isOpen) return null;

  const handleTrade = async () => {
    setLoading(true);
    try {
      // Simulate trade processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Navigate to confirmation page
      const params = new URLSearchParams({
        tokenName: tokenData.name,
        tokenSymbol: tokenData.symbol,
        amount: action === "buy" ? "1000" : "500",
        mode: action,
      });

      onClose();
      router.push(`/trade/confirmation?${params.toString()}`);
    } catch (error) {
      console.error("Trade error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-bg-card border border-border-subtle rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center border border-[var(--cyan-primary)]/30">
              <ArrowUpDown className="w-5 h-5 text-[var(--cyan-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Trade Token</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-bg-card-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Token Info */}
          <div className="flex items-center gap-3 p-3 bg-bg-card-hover rounded-xl border border-border-subtle">
            <div className="w-12 h-12 rounded-xl bg-bg-card flex items-center justify-center overflow-hidden flex-shrink-0">
              {tokenData.logoUrl ? (
                <Image src={tokenData.logoUrl || "/placeholder.svg"} alt={tokenData.symbol} width={48} height={48} />
              ) : (
                <span className="text-lg font-bold text-text-muted">{tokenData.symbol[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{tokenData.name}</p>
              <p className="text-xs text-text-muted">{tokenData.symbol}</p>
            </div>
          </div>

          {/* Scan Status Info */}
          {tokenData.score && (
            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-emerald-500/10 to-[var(--cyan-primary)]/10 border border-emerald-500/30 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--cyan-primary)] to-[var(--cyan-secondary)] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">{tokenData.score}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-400 mb-1">Security Verified</p>
                <p className="text-xs text-text-muted">
                  Grade {tokenData.grade} - This token has been scanned and verified.
                </p>
              </div>
            </div>
          )}

          {/* Action Selector */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Action</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction("buy")}
                className={`h-10 rounded-lg text-sm font-medium transition-all ${
                  action === "buy"
                    ? "bg-gradient-to-r from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 text-[var(--cyan-primary)] border border-[var(--cyan-primary)]/30"
                    : "bg-bg-card-hover text-text-muted border border-border-subtle"
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setAction("sell")}
                className={`h-10 rounded-lg text-sm font-medium transition-all ${
                  action === "sell"
                    ? "bg-gradient-to-r from-rose-500/20 to-red-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-bg-card-hover text-text-muted border border-border-subtle"
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Wallet Connection */}
          {!connected && (
            <button
              type="button"
              onClick={connect}
              className="w-full h-12 rounded-xl bg-bg-card-hover border border-border-subtle text-text-secondary text-sm font-medium hover:bg-bg-card transition-all"
            >
              Connect Wallet (Optional)
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleTrade}
              disabled={loading}
              className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-[var(--cyan-primary)] shadow-[0_0_16px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 0 20" strokeWidth="2" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpDown className="w-4 h-4" />
                  {action === "buy" ? "Buy Now" : "Sell Now"}
                </>
              )}
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-text-muted text-center">
            Trading is performed via external DEX. Always verify token security before trading.
          </p>
        </div>
      </div>
    </div>
  );
}
