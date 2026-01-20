"use client";

import { Wallet, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  onSimulate?: () => void;
  onShare?: () => void;
  isSticky?: boolean;
}

export function ActionBar({
  onSimulate,
  onShare,
  isSticky = false,
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 w-full",
        isSticky &&
          "fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-md border-t border-white/10 z-50"
      )}
    >
      <button
        type="button"
        onClick={onSimulate}
        className="w-full py-4 px-6 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
      >
        <Wallet className="w-5 h-5" />
        Connect wallet to simulate
      </button>

      <button
        type="button"
        onClick={onShare}
        className="w-full py-3 px-6 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/15 transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share report
      </button>
    </div>
  );
}
