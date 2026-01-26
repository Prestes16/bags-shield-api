"use client";

import React from "react"

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
  const { connected, publicKey, connect, connecting, connectionError, clearError } = useWallet();
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [venue] = useState<"jupiter" | "raydium">("jupiter");
  const [localError, setLocalError] = useState<string>("");

  // Mock price data (in real app, fetch from API)
  const tokenPrice = 0.25;
  const solPrice = 150;

  const validateAmount = (value: string) => {
    if (!value) {
      setAmountError("Please enter an amount");
      return false;
    }

    const numAmount = parseFloat(value);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError("Amount must be greater than 0");
      return false;
    }

    if (numAmount > 1000000) {
      setAmountError("Amount exceeds maximum limit");
      return false;
    }

    setAmountError("");
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    if (value) {
      validateAmount(value);
    }
  };

  const amountInUSD = amount ? (parseFloat(amount) * tokenPrice).toFixed(2) : "0.00";
  const amountInSOL = amount ? (parseFloat(amount) * tokenPrice / solPrice).toFixed(4) : "0.0000";
  const isFormValid = amount && !amountError && parseFloat(amount) > 0;
  const canConfirm = isFormValid && connected;

  if (!isOpen) return null;

  const handleTrade = async () => {
    if (!validateAmount(amount)) {
      return;
    }

    if (!connected) {
      setLocalError("");
      const success = await connect();
      if (!success) {
        setLocalError(connectionError || "Failed to connect wallet. Please try again.");
      }
      return;
    }

    setLoading(true);
    try {
      // Simulate trade processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Navigate to confirmation page
      const params = new URLSearchParams({
        tokenName: tokenData.name,
        tokenSymbol: tokenData.symbol,
        amount: amount,
        mode: action,
        totalUSD: amountInUSD,
        totalSOL: amountInSOL,
      });

      onClose();
      router.push(`/trade/confirmation?${params.toString()}`);
    } catch (error) {
      setLocalError("Trade processing failed. Please try again.");
      console.error("[v0] Trade error:", error);
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

        {/* Error Messages */}
        {(localError || connectionError) && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-rose-400 font-medium">{localError || connectionError}</p>
              {(localError || connectionError) && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalError("");
                    clearError();
                  }}
                  className="text-xs text-rose-300 mt-1 hover:text-rose-200 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Token Info */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] flex items-center justify-center">
            <span className="text-xs font-bold text-white">1</span>
          </div>
          <span className="text-xs font-semibold text-text-secondary">Select Amount</span>
        </div>

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
            <p className="text-xs text-text-muted">Price: ${tokenPrice}</p>
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

        {/* Amount Input */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">
            Amount to {action === "buy" ? "Buy" : "Sell"}
          </label>
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            placeholder="Enter amount"
            min="0"
            step="1"
            className={`w-full px-4 py-3 bg-bg-input border rounded-xl text-text-primary placeholder:text-text-muted transition-all ${
              amountError
                ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-border-subtle focus:border-[var(--cyan-primary)]/50 focus:ring-[var(--cyan-primary)]/20"
            } focus:outline-none focus:ring-2`}
          />
          {amountError && (
            <p className="text-xs text-rose-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {amountError}
            </p>
          )}
        </div>

        {/* Price Breakdown */}
        {isFormValid && (
          <div className="p-3 bg-bg-card-hover rounded-xl border border-border-subtle space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Total ({tokenData.symbol}):</span>
              <span className="font-semibold text-text-primary">{parseFloat(amount).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Estimated Cost (USD):</span>
              <span className="font-semibold text-[var(--cyan-primary)]">${amountInUSD}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Estimated Cost (SOL):</span>
              <span className="font-semibold text-[var(--cyan-primary)]">{amountInSOL} SOL</span>
            </div>
            <div className="border-t border-border-subtle pt-2 mt-2 flex items-center justify-between text-sm">
              <span className="text-text-muted font-medium">Network Fee:</span>
              <span className="text-text-secondary text-xs">~0.00025 SOL</span>
            </div>
          </div>
        )}

        {/* Action Selector */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Transaction Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAction("buy");
                setAmount("");
              }}
              className={`h-10 rounded-lg text-sm font-medium transition-all ${
                action === "buy"
                  ? "bg-gradient-to-r from-emerald-500/20 to-emerald-400/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-bg-card-hover text-text-muted border border-border-subtle"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => {
                setAction("sell");
                setAmount("");
              }}
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

        {/* Step 2: Wallet Connection */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            connected
              ? "bg-emerald-500/20 border border-emerald-500/30"
              : "bg-[var(--cyan-primary)]/20 border border-[var(--cyan-primary)]/30"
          }`}>
            <span className="text-xs font-bold text-emerald-400">{connected ? "✓" : "2"}</span>
          </div>
          <span className="text-xs font-semibold text-text-secondary">
            {connected ? "Wallet Connected" : "Connect Wallet"}
          </span>
        </div>

        {/* Wallet Connection Section */}
        {!connected && (
          <div className="p-4 bg-[var(--cyan-primary)]/5 border border-[var(--cyan-primary)]/30 rounded-xl">
            <p className="text-sm text-text-secondary mb-3">
              Connect your Solana wallet to proceed with this transaction. This is required to confirm and execute your {action}.
            </p>
            <button
              type="button"
              onClick={connect}
              disabled={connecting}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 0 20" strokeWidth="2" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        )}

        {connected && publicKey && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-400">Wallet Connected</p>
              <p className="text-xs text-text-muted truncate">{publicKey.slice(0, 6)}...{publicKey.slice(-4)}</p>
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-lg font-medium text-text-secondary bg-bg-card border border-border-subtle hover:bg-bg-card-hover transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTrade}
            disabled={!canConfirm || loading}
            className="flex-1 h-11 rounded-lg font-semibold text-white bg-gradient-to-r from-emerald-500 to-[var(--cyan-primary)] shadow-[0_0_16px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
                {!connected && "Connect & Confirm"}
                {connected && action === "buy" && "Confirm Buy"}
                {connected && action === "sell" && "Confirm Sell"}
              </>
            )}
          </button>
        </div>

        {/* Disclaimer */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-[10px] text-amber-400/80">
            ⚠️ Trading involves risk. Always verify token security before executing trades. Gas fees apply and amounts are subject to slippage.
          </p>
        </div>
      </div>
    </div>
  );
}
