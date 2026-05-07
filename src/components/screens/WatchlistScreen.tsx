"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { WatchlistSkeleton } from "@/components/states/WatchlistSkeleton";
import { EmptyWatchlist } from "@/components/states/EmptyWatchlist";

// Ícones SVG inline (substituindo lucide-react)
const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const TrendingDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);

// Interface para garantir o Padrão Ouro de tipagem
interface WatchedToken {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  price: number;
  change24h: number;
  shieldScore: number;
  hasAlert: boolean;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const [tokens, setTokens] = useState<WatchedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulação de carregamento de dados da sua API Solana
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const tid = setTimeout(() => {
        if (cancelled) return;
        setTokens([
          {
            id: "1",
            name: "Solana",
            symbol: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            price: 145.2,
            change24h: 5.4,
            shieldScore: 98,
            hasAlert: false,
          },
          {
            id: "2",
            name: "Bonk",
            symbol: "BONK",
            mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            price: 0.000024,
            change24h: -2.1,
            shieldScore: 72,
            hasAlert: true, // Alerta de mudança de risco!
          },
          {
            id: "3",
            name: "WIF",
            symbol: "WIF",
            mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
            price: 2.45,
            change24h: 3.2,
            shieldScore: 85,
            hasAlert: false,
          },
          {
            id: "4",
            name: "POPCAT",
            symbol: "POPCAT",
            mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
            price: 0.89,
            change24h: -1.5,
            shieldScore: 92,
            hasAlert: true,
          },
        ]);
        if (!cancelled) setIsLoading(false);
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, []);

  const handleNavigateToScan = (mint: string) => {
    router.push(`/scan/loading?mint=${encodeURIComponent(mint)}`);
  };

  const handleAddToken = () => {
    router.push("/scan");
  };

  if (isLoading) return <WatchlistSkeleton />;

  if (tokens.length === 0) return <EmptyWatchlist />;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Profissional */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Watchlist</h1>
            <p className="text-slate-400 text-sm">{tokens.length} tokens monitorados</p>
          </div>
          <button
            onClick={handleAddToken}
            className="bg-cyan-500 p-3 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:scale-105 transition-transform"
          >
            <PlusIcon className="w-6 h-6 text-black" />
          </button>
        </header>

        {/* Lista de Cards Glassmorphism - Grid responsivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tokens.map((token) => (
            <div
              key={token.id}
              onClick={() => handleNavigateToScan(token.mint)}
              className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  <Image
                    src="/images/bags-shield-icon.png"
                    alt="Logo"
                    width={32}
                    height={32}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      if (target.parentElement) {
                        target.parentElement.textContent = "🪙";
                      }
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{token.symbol}</h3>
                  <p className="text-xs text-slate-500 font-mono truncate">
                    {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                  </p>
                </div>
              </div>

              <div className="text-right flex items-center gap-4 flex-shrink-0">
                <div className="hidden md:block">
                  <p className="font-bold text-sm">
                    {token.price < 0.01
                      ? `$${token.price.toExponential(2)}`
                      : `$${token.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}`}
                  </p>
                  <p
                    className={`text-xs flex items-center gap-1 justify-end ${
                      token.change24h >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {token.change24h >= 0 ? (
                      <TrendingUpIcon className="w-3 h-3" />
                    ) : (
                      <TrendingDownIcon className="w-3 h-3" />
                    )}
                    {Math.abs(token.change24h)}%
                  </p>
                </div>

                {/* ShieldScore com Glow Dinâmico */}
                <div
                  className={`relative w-12 h-12 flex items-center justify-center rounded-full border-2 ${
                    token.shieldScore > 80
                      ? "border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      : token.shieldScore > 60
                      ? "border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]"
                      : "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                  }`}
                >
                  <span className="text-sm font-bold">{token.shieldScore}</span>
                  {token.hasAlert && (
                    <BellIcon className="absolute -top-1 -right-1 w-4 h-4 text-orange-500 animate-bounce" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
