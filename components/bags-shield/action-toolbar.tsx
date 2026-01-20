"use client";

import { useState, useCallback } from "react";
import { Copy, Check, RotateCw, Share2 } from "lucide-react";

interface ActionToolbarProps {
  mintAddress: string;
  onScanAgain?: () => void;
  onShare?: () => void;
}

export function ActionToolbar({
  mintAddress,
  onScanAgain,
  onShare,
}: ActionToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleCopyMint = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mintAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [mintAddress]);

  const handleScanAgain = useCallback(() => {
    setIsScanning(true);
    onScanAgain?.();
    setTimeout(() => setIsScanning(false), 1500);
  }, [onScanAgain]);

  const handleShare = useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }
    
    // Try Web Share API first (mobile), fallback to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Bags Shield Report",
          text: "Check out this token analysis on Bags Shield",
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or permission denied - fallback to clipboard
        if (err instanceof Error && err.name !== "AbortError") {
          await navigator.clipboard.writeText(window.location.href);
        }
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch (err) {
        console.error("Failed to copy URL:", err);
      }
    }
  }, [onShare]);

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2">
      <div className="flex items-center justify-between gap-2">
        {/* Copy Mint Button */}
        <button
          type="button"
          onClick={handleCopyMint}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
            font-medium text-sm transition-all duration-300
            ${
              copied
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-transparent"
            }
          `}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Mint</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Scan Again Button */}
        <button
          type="button"
          onClick={handleScanAgain}
          disabled={isScanning}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white font-medium text-sm transition-all duration-300 disabled:opacity-50"
        >
          <RotateCw
            className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Scan Again</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30 font-medium text-sm transition-all duration-300 border border-cyan-500/20"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </div>
  );
}
