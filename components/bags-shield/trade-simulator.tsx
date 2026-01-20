"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Info,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

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
function TradeSimulatorSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header Skeleton */}
      <header className="px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
        <div className="h-6 w-40 bg-white/10 rounded-lg animate-pulse" />
      </header>

      {/* Token Badge Skeleton */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10 w-fit">
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          <div className="h-5 w-24 bg-white/10 rounded animate-pulse" />
        </div>
      </div>

      {/* Main Card Skeleton */}
      <main className="flex-1 px-5 pb-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          {/* Toggle Skeleton */}
          <div className="flex justify-center mb-8">
            <div className="h-14 w-64 bg-white/10 rounded-xl animate-pulse" />
          </div>

          {/* Amount Input Skeleton */}
          <div className="mb-6">
            <div className="h-4 w-24 bg-white/10 rounded mb-3 animate-pulse" />
            <div className="h-16 w-full bg-white/10 rounded-xl animate-pulse" />
            <div className="flex gap-2 mt-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-9 flex-1 bg-white/10 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Slippage Input Skeleton */}
          <div className="mb-6">
            <div className="h-4 w-32 bg-white/10 rounded mb-3 animate-pulse" />
            <div className="h-12 w-full bg-white/10 rounded-xl animate-pulse" />
          </div>

          {/* Preview Card Skeleton */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
            <div className="h-5 w-28 bg-white/10 rounded mb-4 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Button Skeleton */}
          <div className="h-14 w-full bg-white/10 rounded-xl animate-pulse" />
        </div>
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
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<string>("1");
  const [isSimulating, setIsSimulating] = useState(false);

  // Computed estimates
  const estimatedFee = 0.00005;
  const amountNum = Number.parseFloat(amount) || 0;
  const slippageNum = Number.parseFloat(slippage) || 1;
  const estimatedReceived = amountNum > 0 ? amountNum * 1250000 * (1 - slippageNum / 100) : 0;

  const isBuyMode = tradeMode === "buy";

  // Dynamic colors based on trade mode
  const accentColor = isBuyMode ? "cyan" : "rose";
  const gradientFrom = isBuyMode ? "from-cyan-500" : "from-rose-500";
  const gradientTo = isBuyMode ? "to-emerald-500" : "to-red-500";
  const ringColor = isBuyMode ? "ring-cyan-500/50" : "ring-rose-500/50";
  const borderColor = isBuyMode ? "border-cyan-500/30" : "border-rose-500/30";
  const textColor = isBuyMode ? "text-cyan-400" : "text-rose-400";
  const bgColor = isBuyMode ? "bg-cyan-500/10" : "bg-rose-500/10";

  const handleQuickAmount = useCallback((value: string) => {
    if (value === "Max") {
      setAmount("5.0");
    } else {
      setAmount(value);
    }
  }, []);

  const handleSimulation = async () => {
    if (!amount || amountNum <= 0) return;
    
    setIsSimulating(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSimulating(false);
    // Navigate to result page
    router.push("/simulate/result");
  };

  if (isLoading) {
    return <TradeSimulatorSkeleton />;
  }

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header */}
      <header className="px-5 py-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-semibold text-white">Simulador de Trade</h1>
      </header>

      {/* Token Badge */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 w-fit">
          <Image
            src={token.logoUrl || "/placeholder.svg"}
            alt={token.name}
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="text-white font-medium">{token.pair}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-5 pb-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 max-w-xl mx-auto">
          {/* Buy/Sell Toggle */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-white/5 rounded-xl p-1.5 border border-white/10">
              <button
                type="button"
                onClick={() => setTradeMode("buy")}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  isBuyMode
                    ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                BUY
              </button>
              <button
                type="button"
                onClick={() => setTradeMode("sell")}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  !isBuyMode
                    ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <TrendingDown className="w-5 h-5" />
                SELL
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-slate-400 text-sm mb-3 font-medium">
              {isBuyMode ? "Quantidade (SOL)" : "Quantidade (Tokens)"}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full bg-white/5 border ${borderColor} rounded-xl px-5 py-4 text-2xl font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-2 ${ringColor} transition-all duration-200`}
              />
              <span className={`absolute right-5 top-1/2 -translate-y-1/2 ${textColor} font-semibold`}>
                {isBuyMode ? "SOL" : token.symbol}
              </span>
            </div>
            
            {/* Quick Amount Buttons */}
            <div className="flex gap-2 mt-3">
              {["0.1", "0.5", "1.0", "Max"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleQuickAmount(value)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border border-white/10 ${bgColor} ${textColor} hover:bg-white/10 transition-all duration-200`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Slippage Input */}
          <div className="mb-6">
            <label className="block text-slate-400 text-sm mb-3 font-medium flex items-center gap-2">
              Tolerancia de Slippage (%)
              <button type="button" className="text-slate-500 hover:text-white transition-colors">
                <Info className="w-4 h-4" />
              </button>
            </label>
            <div className="flex gap-2">
              {["0.5", "1", "3", "5"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSlippage(value)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border transition-all duration-200 ${
                    slippage === value
                      ? `${bgColor} ${borderColor} ${textColor}`
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {value}%
                </button>
              ))}
              <div className="relative flex-1">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className={`w-full h-full bg-white/5 border border-white/10 rounded-lg px-3 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 ${ringColor} transition-all duration-200`}
                  placeholder="Custom"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className={`bg-white/5 rounded-xl p-5 border ${borderColor} mb-6`}>
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo}`} />
              Estimativas
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm flex items-center gap-2">
                  Taxa Estimada (Fee)
                  <button type="button" className="text-slate-500 hover:text-white transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </span>
                <span className="text-white font-mono text-sm">~{estimatedFee} SOL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm flex items-center gap-2">
                  Preco de Impacto
                  <button type="button" className="text-slate-500 hover:text-white transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </span>
                <span className={`font-mono text-sm ${amountNum > 2 ? "text-yellow-400" : "text-emerald-400"}`}>
                  {amountNum > 0 ? `~${(amountNum * 0.1).toFixed(2)}%` : "--"}
                </span>
              </div>
              <div className="h-px bg-white/10 my-2" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm flex items-center gap-2">
                  {isBuyMode ? "Valor Recebido (Min)" : "SOL Recebido (Min)"}
                  <button type="button" className="text-slate-500 hover:text-white transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </span>
                <span className={`font-bold text-lg ${textColor}`}>
                  {amountNum > 0
                    ? isBuyMode
                      ? `~${estimatedReceived.toLocaleString()} ${token.symbol}`
                      : `~${(amountNum / 1250000).toFixed(4)} SOL`
                    : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Run Simulation Button */}
          <button
            type="button"
            onClick={handleSimulation}
            disabled={isSimulating || !amount || amountNum <= 0}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${
              isBuyMode
                ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25"
                : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-rose-500/25"
            }`}
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Simulating Route...
              </>
            ) : (
              "Run Simulation"
            )}
          </button>
        </div>
      </main>

      {/* Home Indicator */}
      <div className="flex justify-center pb-4">
        <div className="w-32 h-1 bg-slate-700 rounded-full" />
      </div>
    </div>
  );
}
