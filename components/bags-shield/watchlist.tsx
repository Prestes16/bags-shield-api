"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Bell,
  BellOff,
  Search,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Trash2,
  Home,
  ShieldAlert,
  ShieldCheck,
  Scan,
  FileText,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import { BottomNav } from "@/components/ui/bottom-nav";

// Types - Ready for API integration
interface WatchlistToken {
  id: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  mintAddress: string;
  price?: number;
  priceChange24h?: number;
  scanned: boolean;
  score?: number;
  riskLabel?: "low" | "medium" | "high" | "critical";
  hasAlerts: boolean;
  isScamHistory?: boolean; // Frozen scam record from known scam database
}

interface WatchlistProps {
  tokens?: WatchlistToken[];
  isLoading?: boolean;
  onAddToken?: () => void;
  onScanToken?: (tokenId: string) => void;
  onRemoveToken?: (tokenId: string) => void;
  onViewReport?: (tokenId: string) => void;
  onToggleAlerts?: (tokenId: string) => void;
}

// Mini Score Ring for scanned tokens
function MiniScoreRing({ score }: { score: number }) {
  const radius = 16;
  const stroke = 3;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return { stroke: "#22c55e", glow: "shadow-emerald-500/40" };
    if (s >= 60) return { stroke: "#eab308", glow: "shadow-yellow-500/40" };
    if (s >= 40) return { stroke: "#f97316", glow: "shadow-orange-500/40" };
    return { stroke: "#ef4444", glow: "shadow-red-500/40" };
  };

  const colors = getColor(score);

  return (
    <div className={cn("relative w-10 h-10 flex items-center justify-center")}>
      <svg width={radius * 2} height={radius * 2} className="rotate-[-90deg]">
        {/* Background circle */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle className="text-right"
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          stroke={colors.stroke}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-white">{score}</span>
    </div>
  );
}

// Risk Badge
function RiskBadge({ risk }: { risk: "low" | "medium" | "high" | "critical" }) {
  const config = {
    low: { label: "Low", bg: "bg-emerald-500/20", text: "text-emerald-400" },
    medium: { label: "Med", bg: "bg-yellow-500/20", text: "text-yellow-400" },
    high: { label: "High", bg: "bg-orange-500/20", text: "text-orange-400" },
    critical: { label: "Crit", bg: "bg-red-500/20", text: "text-red-400" },
  };

  const c = config[risk];

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", c.bg, c.text)}>
      {c.label}
    </span>
  );
}

// Token Card Component
function TokenCard({
  token,
  t,
  onScan,
  onViewReport,
  onRemove,
  onToggleAlerts,
  onScanAndTrade,
}: {
  token: WatchlistToken;
  t: ReturnType<typeof useLanguage>["t"];
  onScan: () => void;
  onViewReport: () => void;
  onRemove: () => void;
  onToggleAlerts: () => void;
  onScanAndTrade: () => void;
}) {
  const isPositive = (token.priceChange24h ?? 0) >= 0;
  const showScore = token.scanned && token.score !== undefined;
  const isScamHistory = token.isScamHistory && token.scanned;

  return (
    <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
      {/* Main Info Row */}
      <div className="flex items-start gap-3 p-4">
        {/* Token Avatar */}
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          <Image
            src={token.logoUrl || "/images/bags-token-icon.jpg"}
            alt={token.symbol}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Token Info & Price */}
        <div className="flex-1 min-w-0">
          {/* Top Row: Symbol + Badges */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-text-primary font-bold text-base">{token.symbol}</span>
            {token.hasAlerts && (
              <Bell className="w-3.5 h-3.5 text-[var(--cyan-primary)] flex-shrink-0" />
            )}
            {isScamHistory && (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                SCAM HISTORY
              </span>
            )}
          </div>

          {/* Bottom Row: Price + Change */}
          {token.price !== undefined ? (
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm font-medium">
                ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(2)}
              </span>
              {token.priceChange24h !== undefined && (
                <span
                  className={cn(
                    "text-xs font-semibold flex items-center gap-0.5",
                    isPositive ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(token.priceChange24h).toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            <span className="text-text-muted text-sm">{token.name}</span>
          )}
        </div>

        {/* Right: Score/Status */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {showScore ? (
            <>
              <MiniScoreRing score={token.score!} />
              {token.riskLabel && <RiskBadge risk={token.riskLabel} />}
            </>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/50 text-text-muted text-[11px] font-medium border border-border-subtle">
              Not scanned
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-3 border-t border-border-subtle">
        {/* Scan & Trade Button (Always visible) */}
        <button
          type="button"
          onClick={onScanAndTrade}
          className="col-span-1 flex items-center justify-center gap-1.5 py-3 text-[var(--cyan-primary)] text-xs font-semibold hover:bg-[var(--cyan-primary)]/10 transition-colors border-r border-border-subtle"
        >
          <Scan className="w-4 h-4" />
          <span className="hidden sm:inline">Scan & Trade</span>
          <span className="sm:hidden">Trade</span>
        </button>

        {/* View Report / Scan Now (Conditional) */}
        {token.scanned ? (
          <button
            type="button"
            onClick={onViewReport}
            className="col-span-1 flex items-center justify-center gap-1.5 py-3 text-text-secondary text-xs font-medium hover:bg-bg-card-hover transition-colors border-r border-border-subtle"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span>
            <span className="sm:hidden">Info</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onScan}
            className="col-span-1 flex items-center justify-center gap-1.5 py-3 bg-[var(--cyan-primary)]/20 text-[var(--cyan-primary)] text-xs font-semibold hover:bg-[var(--cyan-primary)]/30 transition-colors border-r border-border-subtle"
          >
            <Scan className="w-4 h-4" />
            <span className="hidden sm:inline">Scan</span>
            <span className="sm:hidden">Scan</span>
          </button>
        )}

        {/* Alert + Remove (Combined) */}
        <div className="col-span-1 flex items-center">
          <button
            type="button"
            onClick={onToggleAlerts}
            className={cn(
              "flex-1 h-full flex items-center justify-center transition-colors border-r border-border-subtle",
              token.hasAlerts
                ? "text-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/10"
                : "text-text-muted hover:bg-bg-card-hover"
            )}
            title={token.hasAlerts ? "Alerts ON" : "Alerts OFF"}
          >
            {token.hasAlerts ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
          
          <button
            type="button"
            onClick={onRemove}
            className="flex-1 h-full flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty State
function EmptyState({ t, onExplore }: { t: ReturnType<typeof useLanguage>["t"]; onExplore: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-[var(--cyan-primary)]/20 blur-3xl rounded-full" />
        <ShieldAlert className="w-16 h-16 text-slate-600 relative" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2 text-center">
        {t.watchlist.emptyTitle}
      </h3>
      <p className="text-slate-400 text-sm text-center mb-6 max-w-xs leading-relaxed">
        {t.watchlist.emptyDescription}
      </p>
      <button
        type="button"
        onClick={onExplore}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[var(--cyan-glow)]"
      >
        <ShieldCheck className="w-4 h-4" />
        {t.watchlist.exploreTokens}
      </button>
    </div>
  );
}

// Loading Skeleton
function WatchlistSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-[#0c1a2e]/80 border border-white/[0.06] rounded-xl p-3 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-16" />
              <div className="h-3 bg-white/10 rounded w-24" />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Watchlist Component
export function Watchlist({
  tokens = [],
  isLoading = false,
  onAddToken,
  onScanToken,
  onRemoveToken,
  onViewReport,
  onToggleAlerts,
}: WatchlistProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [liveTokens, setLiveTokens] = useState<WatchlistToken[]>(tokens);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Fetch live prices for all tokens
  const fetchLivePrices = async (tokensToUpdate: WatchlistToken[]) => {
    if (tokensToUpdate.length === 0) return;

    setIsLoadingPrices(true);
    try {
      const mintAddresses = tokensToUpdate.map((t) => t.mintAddress);
      const response = await fetch("/api/tokens/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mints: mintAddresses }),
      });

      if (!response.ok) {
        console.error("[v0] Failed to fetch prices:", response.status);
        return;
      }

      const priceData = await response.json();

      setLiveTokens((prev) =>
        prev.map((token) => {
          const price = priceData[token.mintAddress];
          if (price) {
            return {
              ...token,
              price: price.price,
              priceChange24h: price.priceChange24h,
            };
          }
          return token;
        })
      );
    } catch (error) {
      console.error("[v0] Error fetching live prices:", error);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Update prices on mount and every 30 seconds
  useState(() => {
    if (tokens.length > 0) {
      setLiveTokens(tokens);
      fetchLivePrices(tokens);

      const interval = setInterval(() => {
        fetchLivePrices(tokens);
      }, 30000); // Update every 30s

      return () => clearInterval(interval);
    }
  });

  const filteredTokens = liveTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToken = () => {
    onAddToken?.() ?? router.push("/");
  };

  const handleScanToken = (tokenId: string) => {
    const token = filteredTokens.find((t) => t.id === tokenId);
    if (token) {
      onScanToken?.(tokenId) ?? router.push(`/scan?address=${token.mintAddress}`);
    }
  };

  const handleViewReport = (tokenId: string) => {
    onViewReport?.(tokenId) ?? router.push(`/finding/${tokenId}`);
  };

  const handleRemoveToken = (tokenId: string) => {
    onRemoveToken?.(tokenId);
  };

  const handleToggleAlerts = (tokenId: string) => {
    onToggleAlerts?.(tokenId);
  };

  const handleScanAndTrade = (tokenId: string) => {
    const token = filteredTokens.find((t) => t.id === tokenId);
    if (token) {
      // Go to scan page with trade intent
      router.push(`/scan?address=${token.mintAddress}`);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-page/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 py-3">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title={t.watchlist.backToHome}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">{t.watchlist.title}</h1>
                {tokens.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {tokens.length} {t.watchlist.tokens}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddToken}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] flex items-center justify-center shadow-lg shadow-[var(--cyan-glow)] hover:opacity-90 transition-all"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Search Bar */}
          {tokens.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={t.watchlist.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-bg-input border border-border-subtle rounded-xl text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-[var(--cyan-primary)]/50 transition-colors"
              />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-4 pb-24">
        {isLoading ? (
          <WatchlistSkeleton />
        ) : tokens.length === 0 ? (
          <EmptyState t={t} onExplore={() => router.push("/")} />
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {t.watchlist.noResults} "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTokens.map((token) => (
              <TokenCard
                key={token.id}
                token={token}
                t={t}
                onScan={() => handleScanToken(token.id)}
                onViewReport={() => handleViewReport(token.id)}
                onRemove={() => handleRemoveToken(token.id)}
                onToggleAlerts={() => handleToggleAlerts(token.id)}
                onScanAndTrade={() => handleScanAndTrade(token.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav 
        items={[
          { icon: Home, label: t.nav.home, href: "/" },
          { icon: Search, label: t.nav.search, href: "/search" },
          { icon: History, label: t.nav.history, href: "/history" },
          { icon: Settings, label: t.nav.settings, href: "/settings" },
        ]}
      />
    </div>
  );
}

// Demo with real data from localStorage and Helius API
export default function WatchlistDemo() {
  const [tokens, setTokens] = useState<WatchlistToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tokens from localStorage and fetch real data
  const loadWatchlistTokens = async () => {
    try {
      // Import the storage functions dynamically to avoid SSR issues
      const { getWatchlist } = await import("@/lib/watchlist-storage");
      const storedTokens = getWatchlist();

      if (storedTokens.length === 0) {
        // Add some default popular tokens if watchlist is empty
        const { addToWatchlist } = await import("@/lib/watchlist-storage");
        const defaultTokens = [
          {
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Wrapped SOL",
            logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
            hasAlerts: false,
          },
          {
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            symbol: "USDC",
            name: "USD Coin",
            logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
            hasAlerts: false,
          },
          {
            mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            symbol: "BONK",
            name: "Bonk",
            logoUrl: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
            hasAlerts: false,
          },
          {
            mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            symbol: "JUP",
            name: "Jupiter",
            logoUrl: "https://static.jup.ag/jup/icon.png",
            hasAlerts: false,
          },
        ];

        for (const token of defaultTokens) {
          addToWatchlist(token);
        }

        // Reload after adding defaults
        return loadWatchlistTokens();
      }

      // Convert stored tokens to component format
      const watchlistTokens: WatchlistToken[] = await Promise.all(
        storedTokens.map(async (stored) => {
          // Fetch real-time data for each token
          let metadata = null;
          let price = null;

          try {
            const response = await fetch("/api/tokens/metadata", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mint: stored.mint }),
            });

            if (response.ok) {
              const data = await response.json();
              metadata = data;
              price = { price: data.price, priceChange24h: data.priceChange24h };
            }
          } catch (error) {
            console.error("[v0] Error fetching token data:", stored.mint, error);
          }

          return {
            id: stored.mint,
            symbol: metadata?.symbol || stored.symbol,
            name: metadata?.name || stored.name,
            logoUrl: metadata?.image || stored.logoUrl || "/images/bags-token-icon.jpg",
            mintAddress: stored.mint,
            price: price?.price,
            priceChange24h: price?.priceChange24h,
            scanned: !!stored.lastScanned,
            score: stored.score,
            riskLabel: stored.riskLabel,
            hasAlerts: stored.hasAlerts,
            isScamHistory: stored.score !== undefined && stored.score < 20,
          };
        })
      );

      setTokens(watchlistTokens);
    } catch (error) {
      console.error("[v0] Error loading watchlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount
  useState(() => {
    loadWatchlistTokens();

    // Listen for watchlist updates
    const handleUpdate = () => {
      loadWatchlistTokens();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("watchlist-updated", handleUpdate);
      return () => window.removeEventListener("watchlist-updated", handleUpdate);
    }
  });

  const handleRemoveToken = async (tokenId: string) => {
    const { removeFromWatchlist } = await import("@/lib/watchlist-storage");
    removeFromWatchlist(tokenId);
  };

  const handleToggleAlerts = async (tokenId: string) => {
    const { toggleTokenAlerts } = await import("@/lib/watchlist-storage");
    toggleTokenAlerts(tokenId);
  };

  return (
    <Watchlist
      tokens={tokens}
      isLoading={isLoading}
      onRemoveToken={handleRemoveToken}
      onToggleAlerts={handleToggleAlerts}
    />
  );
}
