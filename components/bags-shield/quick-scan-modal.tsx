"use client";

import React from "react"

import { useState, useEffect, useCallback } from "react";
import { X, Scan, AlertCircle, HelpCircle, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

interface QuickScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (mint: string) => void;
}

// Validate Solana base58 address (32-44 chars, valid base58 chars)
const isValidSolanaMint = (value: string): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  // Solana addresses are 32-44 characters, base58 encoded (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(trimmed);
};

export function QuickScanModal({ isOpen, onClose, onScan }: QuickScanModalProps) {
  const { t } = useLanguage();
  const [mintAddress, setMintAddress] = useState("");
  const [showError, setShowError] = useState(false);

  const isValid = isValidSolanaMint(mintAddress);
  const hasInput = mintAddress.trim().length > 0;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMintAddress("");
      setShowError(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleScan = useCallback(() => {
    if (isValid) {
      onScan(mintAddress.trim());
      onClose();
    } else if (hasInput) {
      setShowError(true);
    }
  }, [isValid, hasInput, mintAddress, onScan, onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMintAddress(e.target.value);
    setShowError(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="relative bg-bg-card border-t border-border-subtle rounded-t-3xl shadow-2xl max-w-lg mx-auto overflow-hidden backdrop-blur-xl">
          {/* Animated gradient border at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--cyan-primary)] to-transparent opacity-60 animate-pulse" />
          
          {/* Drag Handle */}
          <div className="flex justify-center pt-4 pb-3">
            <div className="w-12 h-1 bg-text-muted/30 rounded-full" />
          </div>

          {/* Header Section - Mobile Optimized */}
          <div className="px-4 sm:px-6 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--cyan-primary)]/10 to-[var(--cyan-secondary)]/10 flex items-center justify-center border border-[var(--cyan-primary)]/30 shadow-md shadow-[var(--cyan-glow)]/20 flex-shrink-0">
                  <div className="absolute inset-0 rounded-xl bg-[var(--cyan-primary)]/5 animate-pulse" />
                  <Scan className="w-6 h-6 text-[var(--cyan-primary)] relative z-10" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-text-primary mb-0.5 tracking-tight truncate">
                    {t.quickScan?.title || "Scan Token"}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted leading-snug">
                    {t.quickScan?.subtitle || "Enter a token mint address"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-bg-page/80 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-page transition-all active:scale-95 border border-border-subtle/50 flex-shrink-0 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Section - Mobile Optimized */}
          <div className="px-4 sm:px-6 pb-6">
            {/* Input Field */}
            <div className="mb-5">
              <label className="block text-xs sm:text-sm font-semibold text-text-secondary mb-2">
                {t.quickScan?.mintAddress || "Token Mint Address"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={mintAddress}
                  onChange={handleInputChange}
                  placeholder={t.quickScan?.placeholder || "So111111..."}
                  className={cn(
                    "w-full h-12 sm:h-14 pl-3 sm:pl-4 pr-12 sm:pr-14 rounded-xl bg-bg-input border-2 text-text-primary font-mono text-xs sm:text-sm transition-all duration-200 touch-manipulation",
                    "focus:outline-none focus:ring-4 focus:ring-[var(--cyan-primary)]/20",
                    "placeholder:text-text-muted/50",
                    showError && !isValid
                      ? "border-red-500/60 focus:border-red-500 bg-red-500/5 focus:ring-red-500/20"
                      : isValid
                      ? "border-emerald-500/60 focus:border-emerald-500 bg-emerald-500/5 focus:ring-emerald-500/20"
                      : "border-border-subtle focus:border-[var(--cyan-primary)]"
                  )}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                {hasInput && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-200">
                    {isValid ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/40 animate-in zoom-in duration-200">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Error Message */}
              {showError && !isValid && (
                <div className="mt-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl animate-in slide-in-from-top duration-200">
                  <p className="text-xs text-red-400 flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{t.quickScan?.invalidAddress || "Please enter a valid Solana mint address"}</span>
                  </p>
                </div>
              )}

              {/* Info Helper */}
              {!showError && (
                <div className="flex items-start gap-3 mt-4 p-4 bg-[var(--cyan-primary)]/5 border border-[var(--cyan-primary)]/20 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-[var(--cyan-primary)]/10 flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="w-5 h-5 text-[var(--cyan-primary)]" />
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed pt-1">
                    {t.quickScan?.helperText || "A mint address is the unique identifier of a Solana token. You can find it on block explorers like Solscan or in your wallet."}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-xl font-semibold text-text-secondary bg-bg-page hover:bg-bg-card-hover transition-all border border-border-subtle hover:border-text-muted/30 active:scale-[0.97]"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleScan}
                disabled={!isValid}
                className={cn(
                  "h-12 rounded-xl font-bold transition-all flex items-center justify-center gap-2.5 text-sm active:scale-[0.97]",
                  isValid
                    ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white shadow-lg shadow-[var(--cyan-glow)]/40 hover:shadow-xl hover:shadow-[var(--cyan-glow)]/60 border border-[var(--cyan-primary)]/50"
                    : "bg-bg-card-hover text-text-muted border border-border-subtle cursor-not-allowed opacity-60"
                )}
              >
                <Scan className="w-5 h-5" />
                <span>{t.quickScan?.scanButton || "Scan Token"}</span>
              </button>
            </div>
          </div>

          {/* Safe area for mobile notch */}
          <div className="pb-safe" />
        </div>
      </div>
    </>
  );
}

// Inline scan input for /scan page when no mint is provided
export function InlineScanInput({ onScan }: { onScan: (mint: string) => void }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [mintAddress, setMintAddress] = useState("");
  const [showError, setShowError] = useState(false);

  const isValid = isValidSolanaMint(mintAddress);
  const hasInput = mintAddress.trim().length > 0;

  const handleScan = () => {
    if (isValid) {
      onScan(mintAddress.trim());
    } else if (hasInput) {
      setShowError(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMintAddress(e.target.value);
    setShowError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      handleScan();
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex flex-col items-center justify-center px-4 relative">
      {/* Discrete Back to Home button */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary transition-all bg-bg-card/50 hover:bg-bg-card border border-border-subtle/50 hover:border-border-subtle group"
        title={t.common?.backToHome || "Back to Home"}
      >
        <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
      </button>

      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center border border-[var(--cyan-primary)]/30 shadow-[0_0_32px_var(--cyan-glow)]">
            <Scan className="w-10 h-10 text-[var(--cyan-primary)]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            {t.quickScan?.title || "Scan Token"}
          </h1>
          <p className="text-sm text-text-muted">
            {t.quickScan?.subtitle || "Enter a token mint address to analyze"}
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-bg-card rounded-2xl p-5 border border-border-subtle shadow-lg">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t.quickScan?.mintAddress || "Token Mint Address"}
          </label>
          <div className="relative mb-4">
            <input
              type="text"
              value={mintAddress}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t.quickScan?.placeholder || "So111111..."}
              className={cn(
                "w-full h-14 px-4 rounded-xl bg-bg-input border text-text-primary font-mono text-sm",
                "focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all",
                "placeholder:text-text-muted/50",
                showError && !isValid
                  ? "border-red-500/50 focus:border-red-500/50"
                  : "border-border-subtle focus:border-cyan-500/50"
              )}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            {hasInput && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValid ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Error message */}
          {showError && !isValid && (
            <p className="text-xs text-red-400 mb-4 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t.quickScan?.invalidAddress || "Please enter a valid Solana mint address"}
            </p>
          )}

          {/* Scan Button */}
          <button
            type="button"
            onClick={handleScan}
            disabled={!isValid}
            className={cn(
              "w-full h-14 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
              isValid
                ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-[0.98]"
                : "bg-bg-card-hover text-text-muted border border-border-subtle cursor-not-allowed"
            )}
          >
            <Scan className="w-5 h-5" />
            {t.quickScan?.scanButton || "Scan Token"}
          </button>
        </div>

        {/* Helper text */}
        <div className="flex items-start gap-3 mt-4 p-4 bg-bg-card rounded-xl border border-border-subtle">
          <HelpCircle className="w-5 h-5 text-[var(--cyan-primary)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-secondary mb-1">
              {t.quickScan?.whatIsMint || "What is a mint address?"}
            </p>
            <p className="text-xs text-text-muted">
              {t.quickScan?.helperText || "A mint address is the unique identifier of a Solana token. You can find it on block explorers like Solscan or in your wallet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
