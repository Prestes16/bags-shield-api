"use client";

import { useState } from "react";
import { AlertCircle, Zap, Lock } from "lucide-react";
import type { FeatureFlags } from "@/hooks/use-feature-flags";

interface ScanInputCardProps {
  onScan: (mint: string, proScan: boolean) => Promise<void>;
  loading?: boolean;
  error?: string;
  features: FeatureFlags | null;
  isConnected: boolean;
  onConnectRequired?: () => void;
}

export function ScanInputCard({
  onScan,
  loading = false,
  error = "",
  features,
  isConnected,
  onConnectRequired,
}: ScanInputCardProps) {
  const [mint, setMint] = useState("");
  const [proScan, setProScan] = useState(false);
  const [localError, setLocalError] = useState("");

  const validateMint = (value: string): boolean => {
    if (!value.trim()) {
      setLocalError("Enter a token mint address");
      return false;
    }
    if (value.length < 40) {
      setLocalError("Invalid mint address");
      return false;
    }
    setLocalError("");
    return true;
  };

  const handleScan = async () => {
    if (!validateMint(mint)) return;

    if (proScan && !isConnected) {
      setLocalError("Connect wallet to use Pro Scan");
      onConnectRequired?.();
      return;
    }

    try {
      await onScan(mint, proScan);
      setMint("");
      setProScan(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const displayError = localError || error;
  const priceSOL = features?.proScanPriceSOL || 0.5;

  return (
    <div className="w-full space-y-3">
      {/* Input */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-2 px-1">
          Token Mint Address
        </label>
        <input
          type="text"
          value={mint}
          onChange={(e) => {
            setMint(e.target.value);
            if (localError) setLocalError("");
          }}
          placeholder="Paste mint address..."
          className={`w-full px-4 py-3 bg-bg-input border rounded-xl text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:ring-2 ${
            displayError
              ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20"
              : "border-border-subtle focus:border-[var(--cyan-primary)]/50 focus:ring-[var(--cyan-primary)]/20"
          }`}
        />
        {displayError && (
          <p className="text-xs text-rose-400 mt-2 flex items-center gap-1 px-1">
            <AlertCircle className="w-3 h-3" />
            {displayError}
          </p>
        )}
      </div>

      {/* Pro Scan Toggle */}
      {features?.proScanEnabled && (
        <div className="flex items-center justify-between p-3 bg-[var(--cyan-primary)]/5 border border-[var(--cyan-primary)]/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-[var(--cyan-primary)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">Pro Scan</p>
              <p className="text-xs text-text-muted">
                {priceSOL} SOL {isConnected ? "(Connected)" : "(Requires wallet)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProScan(!proScan)}
            className={`w-10 h-6 rounded-full transition-all flex items-center ${
              proScan
                ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] justify-end"
                : "bg-bg-card-hover justify-start"
            }`}
            disabled={!features?.proScanEnabled}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-md mx-0.5" />
          </button>
        </div>
      )}

      {proScan && !isConnected && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            Pro Scan requires a connected wallet. Tap the Connect Wallet button above to proceed.
          </p>
        </div>
      )}

      {/* Scan Button */}
      <button
        type="button"
        onClick={handleScan}
        disabled={loading || !mint.trim()}
        className="w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {loading ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                opacity="0.3"
              />
              <path d="M12 2a10 10 0 0 1 0 20" strokeWidth="2" />
            </svg>
            {proScan ? "Running Pro Scan..." : "Scanning..."}
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            {proScan ? "Pay & Run Pro Scan" : "Run Scan"}
          </>
        )}
      </button>
    </div>
  );
}
