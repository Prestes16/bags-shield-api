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
    <div className="w-full space-y-2.5">
      {/* Input - Mobile Optimized */}
      <div>
        <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 px-1">
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
          className={`w-full px-3 py-2.5 bg-bg-input border rounded-lg text-text-primary text-sm placeholder:text-text-muted transition-all focus:outline-none focus:ring-2 touch-manipulation ${
            displayError
              ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20"
              : "border-border-subtle focus:border-[var(--cyan-primary)]/50 focus:ring-[var(--cyan-primary)]/20"
          }`}
        />
        {displayError && (
          <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 px-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
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
            role="switch"
            aria-checked={proScan}
            aria-label="Pro Scan"
            onClick={() => setProScan(!proScan)}
            disabled={!features?.proScanEnabled}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50 ${
              proScan
                ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)]"
                : "bg-bg-input border border-border-subtle"
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                proScan ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
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

      {/* Scan Button - Mobile Optimized */}
      <button
        type="button"
        onClick={handleScan}
        disabled={loading || !mint.trim()}
        className="w-full h-11 rounded-lg font-semibold text-white text-sm bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] shadow-md hover:shadow-lg hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-sm touch-manipulation min-h-[44px]"
      >
        {loading ? (
          <>
            <svg
              className="w-4 h-4 animate-spin flex-shrink-0"
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
            <span className="truncate">{proScan ? "Running Pro Scan..." : "Scanning..."}</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{proScan ? "Pay & Run Pro Scan" : "Run Scan"}</span>
          </>
        )}
      </button>
    </div>
  );
}
