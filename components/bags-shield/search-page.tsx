"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search as SearchIcon,
  ChevronLeft,
  TrendingUp,
  Flame,
  Clock,
  Shield,
  Home,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import { BottomNav } from "@/components/ui/bottom-nav";

// Types
interface TokenSearchResult {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  logoUrl?: string;
  score?: number;
  grade?: string;
  volume24h?: number;
  trending?: boolean;
}

// Mock trending tokens
const trendingTokens: TokenSearchResult[] = [
  {
    id: "1",
    name: "BONK",
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    logoUrl: "/images/bags-token-icon.jpg",
    score: 85,
    grade: "B",
    volume24h: 2450000,
    trending: true,
  },
  {
    id: "2",
    name: "Jupiter",
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    score: 92,
    grade: "A",
    volume24h: 5200000,
    trending: true,
  },
  {
    id: "3",
    name: "Pyth Network",
    symbol: "PYTH",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    score: 88,
    grade: "B",
    volume24h: 1800000,
  },
];

// Mock recent searches (from local storage)
const recentSearches: TokenSearchResult[] = [
  {
    id: "r1",
    name: "Solana",
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    score: 95,
    grade: "A",
  },
];

export function SearchPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Filter results based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return trendingTokens.filter(
      (token) =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleTokenClick = (token: TokenSearchResult) => {
    router.push(`/scan?mint=${token.mint}`);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    }
    return `$${(volume / 1000).toFixed(0)}K`;
  };

  return (
    <div className="min-h-screen bg-bg-page">
      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-11 h-11 rounded-xl bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-text-primary">
              {t.nav?.search || "Search"}
            </h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tokens by name, symbol or address..."
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-bg-input border border-border-subtle
                         text-text-primary placeholder:text-text-muted text-sm
                         focus:outline-none focus:ring-2 focus:ring-[var(--cyan-primary)]/50 focus:border-[var(--cyan-primary)]/50
                         transition-all touch-manipulation"
              autoFocus
            />
          </div>
        </div>

        {/* Search Results or Trending */}
        {searchQuery.trim() ? (
          <div>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-1">
              Search Results ({searchResults.length})
            </h2>
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm text-text-muted">No tokens found</p>
                <p className="text-xs text-text-muted/70 mt-1">
                  Try searching by name, symbol, or mint address
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((token) => (
                  <TokenCard
                    key={token.id}
                    token={token}
                    onClick={() => handleTokenClick(token)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Recent Searches
                </h2>
                <div className="space-y-2">
                  {recentSearches.map((token) => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      onClick={() => handleTokenClick(token)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            <div>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Trending Tokens
              </h2>
              <div className="space-y-2">
                {trendingTokens.map((token) => (
                  <TokenCard
                    key={token.id}
                    token={token}
                    onClick={() => handleTokenClick(token)}
                    showVolume
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        items={[
          { icon: Home, label: t.nav?.home || "Home", href: "/" },
          { icon: SearchIcon, label: t.nav?.search || "Search", href: "/search" },
          { icon: History, label: t.nav?.history || "History", href: "/history" },
          { icon: Settings, label: t.nav?.settings || "Settings", href: "/settings" },
        ]}
      />
    </div>
  );
}

// Token Card Component
function TokenCard({
  token,
  onClick,
  showVolume = false,
}: {
  token: TokenSearchResult;
  onClick: () => void;
  showVolume?: boolean;
}) {
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    }
    return `$${(volume / 1000).toFixed(0)}K`;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border-subtle hover:bg-bg-card-hover active:scale-[0.99] transition-all touch-manipulation"
    >
      {/* Logo */}
      <div className="relative flex-shrink-0">
        {token.logoUrl ? (
          <Image
            src={token.logoUrl || "/placeholder.svg"}
            alt={token.symbol}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
            <span className="text-xs font-bold text-cyan-400">
              {token.symbol.substring(0, 2)}
            </span>
          </div>
        )}
        {token.trending && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
            <Flame className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-text-primary truncate">
            {token.name}
          </span>
          {token.score && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-page text-text-muted font-medium flex-shrink-0">
              {token.grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>${token.symbol}</span>
          {showVolume && token.volume24h && (
            <>
              <span>•</span>
              <span className="text-cyan-400">
                {formatVolume(token.volume24h)} 24h
              </span>
            </>
          )}
        </div>
      </div>

      {/* Score Badge */}
      {token.score && (
        <div
          className={cn(
            "px-2.5 py-1 text-xs font-semibold rounded-md border flex-shrink-0",
            token.score >= 80
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : token.score >= 60
              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              : "bg-red-500/20 text-red-400 border-red-500/30"
          )}
        >
          {token.score}
        </div>
      )}
    </button>
  );
}
