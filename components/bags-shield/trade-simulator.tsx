"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Info,
  Loader2,
  TrendingUp,
  TrendingDown,
  Home,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

interface TokenInfo {
  name: string;
  symbol: string;
  logoUrl: string;
  pair: string;
}

interface TradeSimulatorProps {
  token?: TokenInfo;
  isLoading?: boolean;
}

// Skeleton Loading Component
function SkeletonPulse({ className }: { className: string }) {
  return <div className={`bg-white/10 animate-pulse rounded ${className}`} />;
}

function TradeSimulatorSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header Skeleton */}
      <header className="px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <SkeletonPulse className="w-10 h-10 rounded-xl" />
        <SkeletonPulse className="h-5 w-32" />
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-5 space-y-5">
        {/* Token Badge */}
        <SkeletonPulse className="h-12 w-36 rounded-xl" />

        {/* Toggle */}
        <SkeletonPulse className="h-12 w-full max-w-xs mx-auto rounded-xl" />

        {/* Amount Input */}
        <div className="space-y-2">
          <SkeletonPulse className="h-4 w-24" />
          <SkeletonPulse className="h-14 w-full rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonPulse key={i} className="flex-1 h-10 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Slippage */}
        <div className="space-y-2">
          <SkeletonPulse className="h-4 w-32" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonPulse key={i} className="flex-1 h-10 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Estimates Card */}
        <SkeletonPulse className="h-32 w-full rounded-xl" />

        {/* Button */}
        <SkeletonPulse className="h-12 w-full rounded-xl" />
      </main>
    </div>
  );
}

export function TradeSimulator({
  token = {
    name: "BONK",
    symbol: "BONK",
    logoUrl: "/images/bags-token-icon.jpg",
    pair: "BONK/SOL",
  },
  isLoading = false,
}: TradeSimulatorProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<string>("1");
  const [isSimulating, setIsSimulating] = useState(false);

  // Computed estimates
  const amountNum = Number.parseFloat(amount) || 0;
  const slippageNum = Number.parseFloat(slippage) || 1;
  const estimatedFee = 0.00005;
  const priceImpact = amountNum > 0 ? amountNum * 0.08 : 0;
  const estimatedReceived = amountNum > 0 ? amountNum * 1250000 * (1 - slippageNum / 100) : 0;

  const isBuyMode = tradeMode === "buy";
  const hasAmount = amountNum > 0;

  // Theme colors based on mode - using CSS variables for theme support
  const accentClass = isBuyMode ? "text-[var(--cyan-primary)]" : "text-rose-400";
  const accentBg = isBuyMode ? "bg-[var(--cyan-primary)]/10" : "bg-rose-500/10";
  const accentBorder = isBuyMode ? "border-[var(--cyan-primary)]/30" : "border-rose-500/30";
  const accentRing = isBuyMode ? "focus:ring-[var(--cyan-primary)]/40" : "focus:ring-rose-500/40";
  const gradientBtn = isBuyMode
    ? "from-[var(--cyan-primary)] to-[var(--cyan-secondary)] shadow-[var(--cyan-glow)]"
    : "from-rose-500 to-red-600 shadow-rose-500/20";

  const handleQuickAmount = useCallback((value: string) => {
    if (value === "max") {
      setAmount("5.0");
    } else {
      setAmount(value);
    }
  }, []);

  const handleSimulation = async () => {
    if (!hasAmount) return;
    setIsSimulating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSimulating(false);
    router.push("/simulate/result");
  };

  if (isLoading) {
    return <TradeSimulatorSkeleton />;
  }

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">{t.simulator.title}</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-white/10 transition-all"
        >
          <Home className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-5">
          {/* Token Badge */}
          <div className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10 w-fit">
            <Image
              src={token.logoUrl || "/placeholder.svg"}
              alt={token.name}
              width={28}
              height={28}
              className="rounded-full"
            />
            <span className="text-text-primary font-medium text-sm">{token.pair}</span>
          </div>

          {/* Buy/Sell Segmented Control */}
          <div className="bg-white/5 rounded-xl p-1 border border-white/10 flex">
            <button
              type="button"
              onClick={() => setTradeMode("buy")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                isBuyMode
                  ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-md shadow-cyan-500/20"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              {t.simulator.buy}
            </button>
            <button
              type="button"
              onClick={() => setTradeMode("sell")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                !isBuyMode
                  ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/20"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              {t.simulator.sell}
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="block text-text-secondary text-xs font-medium">
              {isBuyMode ? t.simulator.amountSol : t.simulator.amountTokens}
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full bg-white/5 border ${accentBorder} rounded-xl px-4 py-3.5 text-xl font-bold text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 ${accentRing} transition-all`}
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 ${accentClass} font-semibold text-sm`}>
                {isBuyMode ? "SOL" : token.symbol}
              </span>
            </div>

            {/* Quick Amount Chips */}
            <div className="flex gap-2">
              {["0.1", "0.5", "1.0", t.simulator.max.toLowerCase()].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleQuickAmount(value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    amount === value || (value === t.simulator.max.toLowerCase() && amount === "5.0")
                      ? `${accentBg} ${accentBorder} ${accentClass}`
                      : "bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:text-text-primary"
                  }`}
                >
                  {value === t.simulator.max.toLowerCase() ? t.simulator.max : value}
                </button>
              ))}
            </div>
          </div>

          {/* Slippage Selector */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-text-secondary text-xs font-medium">
              {t.simulator.slippage}
              <button type="button" className="text-text-muted hover:text-text-primary transition-colors">
                <Info className="w-3.5 h-3.5" />
              </button>
            </label>
            <div className="flex gap-2">
              {["0.5", "1", "3", "5"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSlippage(value)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    slippage === value
                      ? `${accentBg} ${accentBorder} ${accentClass}`
                      : "bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:text-text-primary"
                  }`}
                >
                  {value}%
                </button>
              ))}
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={!["0.5", "1", "3", "5"].includes(slippage) ? slippage : ""}
                  onChange={(e) => setSlippage(e.target.value)}
                  placeholder={t.simulator.custom}
                  className={`w-full h-full bg-white/5 border border-white/10 rounded-lg px-2.5 text-xs font-semibold text-text-primary placeholder-text-muted text-center focus:outline-none focus:ring-2 ${accentRing} transition-all`}
                />
              </div>
            </div>
          </div>

          {/* Estimates Card */}
          <div className={`bg-white/5 rounded-xl p-4 border ${accentBorder}`}>
            <h3 className="flex items-center gap-2 text-text-primary font-semibold text-sm mb-3">
              <div className={`w-1.5 h-1.5 rounded-full ${isBuyMode ? "bg-cyan-400" : "bg-rose-400"}`} />
              {t.simulator.estimates}
            </h3>

            {hasAmount ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs flex items-center gap-1">
                    {t.simulator.estimatedFee}
                    <Info className="w-3 h-3" />
                  </span>
                  <span className="text-text-primary font-mono text-xs">~{estimatedFee} SOL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs flex items-center gap-1">
                    {t.simulator.priceImpact}
                    <Info className="w-3 h-3" />
                  </span>
                  <span className={`font-mono text-xs ${priceImpact > 1 ? "text-yellow-400" : "text-emerald-400"}`}>
                    ~{priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">{t.simulator.minReceived}</span>
                  <span className={`font-bold text-base ${accentClass}`}>
                    {isBuyMode
                      ? `~${estimatedReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol}`
                      : `~${(amountNum / 1250000).toFixed(4)} SOL`}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-xs text-center py-3">{t.simulator.enterAmount}</p>
            )}
          </div>

          {/* Run Simulation Button */}
          <button
            type="button"
            onClick={handleSimulation}
            disabled={isSimulating || !hasAmount}
            className={`w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-r ${gradientBtn} hover:brightness-110`}
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.simulator.simulating}
              </>
            ) : (
              t.simulator.runSimulation
            )}
          </button>
        </div>
      </main>

      {/* Bottom Safe Area / Home Indicator */}
      <div className="flex justify-center pb-2 pt-1">
        <div className="w-28 h-1 bg-white/10 rounded-full" />
      </div>
    </div>
  );
}
