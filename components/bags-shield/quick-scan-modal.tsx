"use client";

import React from "react"

import { useState, useEffect, useCallback } from "react";
import { X, Scan, AlertCircle, HelpCircle } from "lucide-react";
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
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300 px-4 sm:px-0">
        <div className="bg-gradient-to-b from-bg-card to-bg-page border-t-2 border-[var(--cyan-primary)]/30 rounded-t-3xl shadow-2xl shadow-[var(--cyan-glow)]/10 max-w-lg mx-auto overflow-hidden">
          {/* Animated glow at top */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--cyan-primary)] to-transparent opacity-50" />
          
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-border-subtle rounded-full" />
          </div>

          {/* Header */}
          <div className="relative px-5 pb-5">
            <div className="flex items-center gap-4 mb-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center border-2 border-[var(--cyan-primary)]/40 shadow-lg shadow-[var(--cyan-glow)]/20">
                <Scan className="w-7 h-7 text-[var(--cyan-primary)]" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-text-primary mb-0.5">
                  {t.quickScan?.title || "Scan Token"}
                </h2>
                <p className="text-sm text-text-muted">
                  {t.quickScan?.subtitle || "Enter a token mint address to analyze"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-bg-card-hover/50 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 pb-6">
            {/* Input */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-text-secondary mb-2.5">
                {t.quickScan?.mintAddress || "Token Mint Address"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={mintAddress}
                  onChange={handleInputChange}
                  placeholder={t.quickScan?.placeholder || "So111111..."}
                  className={cn(
                    "w-full h-16 pl-4 pr-12 rounded-2xl bg-bg-input/50 backdrop-blur-sm border-2 text-text-primary font-mono text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--cyan-primary)]/40 transition-all",
                    "placeholder:text-text-muted/40",
                    showError && !isValid
                      ? "border-red-500/50 focus:border-red-500 bg-red-500/5"
                      : "border-border-subtle focus:border-[var(--cyan-primary)] focus:bg-bg-input"
                  )}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                {hasInput && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {isValid ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Error message */}
              {showError && !isValid && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-xs text-red-400 flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {t.quickScan?.invalidAddress || "Please enter a valid Solana mint address"}
                  </p>
                </div>
              )}

              {/* Helper text */}
              <div className="flex items-start gap-3 mt-3 p-3.5 bg-[var(--cyan-primary)]/5 border border-[var(--cyan-primary)]/20 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[var(--cyan-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-4 h-4 text-[var(--cyan-primary)]" />
                </div>
                <p className="text-xs text-text-muted leading-relaxed pt-0.5">
                  {t.quickScan?.helperText || "A mint address is the unique identifier of a Solana token. You can find it on block explorers like Solscan or in your wallet."}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-14 rounded-xl font-semibold text-text-secondary bg-bg-card-hover hover:bg-border-subtle transition-all border-2 border-border-subtle active:scale-[0.98]"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleScan}
                disabled={!isValid}
                className={cn(
                  "h-14 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-base active:scale-[0.98]",
                  isValid
                    ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white shadow-[0_0_20px_var(--cyan-glow)] hover:shadow-[0_0_32px_var(--cyan-glow)] border-2 border-[var(--cyan-primary)]/50"
                    : "bg-bg-card-hover text-text-muted border-2 border-border-subtle cursor-not-allowed opacity-50"
                )}
              >
                <Scan className="w-5 h-5" />
                {t.quickScan?.scanButton || "Scan Token"}
              </button>
            </div>
          </div>

          {/* Safe area padding for mobile */}
          <div className="h-safe-bottom" />
        </div>
      </div>
    </>
  );
}

// Inline scan input for /scan page when no mint is provided
export function InlineScanInput({ onScan }: { onScan: (mint: string) => void }) {
  const { t } = useLanguage();
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
    <div className="min-h-screen bg-bg-page flex flex-col items-center justify-center px-4">
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
