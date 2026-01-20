"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Bell,
  BellRing,
  Eye,
  EyeOff,
  RotateCw,
  Trash2,
  Search,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Types
interface WatchlistToken {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string;
  price: number;
  priceChange24h: number;
  shieldScore: number;
  previousScore?: number;
  hasAlert: boolean;
  sparklineData: number[];
}

interface WatchlistProps {
  tokens?: WatchlistToken[];
  isLoading?: boolean;
  onAddToken?: () => void;
  onScanToken?: (tokenId: string) => void;
  onRemoveToken?: (tokenId: string) => void;
  onTokenClick?: (tokenId: string) => void;
}

// Mini Sparkline Component
function Sparkline({
  data,
  isPositive,
}: {
  data: number[];
  isPositive: boolean;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 60;
      const y = 20 - ((value - min) / range) * 16;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="60" height="24" className="flex-shrink-0">
      <defs>
        <linearGradient
          id={`sparkline-${isPositive ? "green" : "red"}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop
            offset="0%"
            stopColor={isPositive ? "#22c55e" : "#ef4444"}
            stopOpacity="0.5"
          />
          <stop
            offset="100%"
            stopColor={isPositive ? "#22c55e" : "#ef4444"}
            stopOpacity="1"
          />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#sparkline-${isPositive ? "green" : "red"})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Mini Shield Score Circle
function MiniShieldScore({
  score,
  hasChanged,
}: {
  score: number;
  hasChanged: boolean;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "from-emerald-400 to-cyan-400";
    if (s >= 60) return "from-yellow-400 to-orange-400";
    return "from-red-400 to-rose-500";
  };

  const getGlowColor = (s: number) => {
    if (s >= 80) return "shadow-emerald-500/40";
    if (s >= 60) return "shadow-yellow-500/40";
    return "shadow-red-500/40";
  };

  return (
    <div
      className={cn(
        "relative w-10 h-10 rounded-full flex items-center justify-center",
        "bg-gradient-to-br",
        getScoreColor(score),
        "shadow-lg",
        getGlowColor(score),
        hasChanged && "animate-pulse"
      )}
    >
      <div className="absolute inset-0.5 rounded-full bg-bg-page flex items-center justify-center">
        <span className="text-xs font-bold text-white">{score}</span>
      </div>
    </div>
  );
}

// Token Card Component
function TokenCard({
  token,
  onScan,
  onRemove,
  onClick,
}: {
  token: WatchlistToken;
  onScan: () => void;
  onRemove: () => void;
  onClick: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isPositive = token.priceChange24h >= 0;
  const hasScoreChanged =
    token.previousScore !== undefined &&
    token.previousScore !== token.shieldScore;

  return (
    <div
      className={cn(
        "relative group",
        "bg-white/5 backdrop-blur-xl",
        "border border-white/10 rounded-2xl",
        "p-4 transition-all duration-300",
        "hover:bg-white/8 hover:border-white/20",
        "cursor-pointer"
      )}
      onClick={() => !showActions && onClick()}
      onKeyDown={(e) => e.key === "Enter" && !showActions && onClick()}
    >
      <div className="flex items-center gap-3">
        {/* Token Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10">
            <Image
              src={token.logoUrl || "/placeholder.svg"}
              alt={token.name}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold truncate">{token.name}</h3>
            <span className="text-slate-500 text-sm">{token.symbol}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white text-sm font-medium">
              ${token.price.toFixed(6)}
            </span>
            <span
              className={cn(
                "text-xs flex items-center gap-0.5",
                isPositive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(token.priceChange24h).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="hidden sm:block">
          <Sparkline data={token.sparklineData} isPositive={isPositive} />
        </div>

        {/* Shield Score */}
        <MiniShieldScore score={token.shieldScore} hasChanged={hasScoreChanged} />

        {/* Alert Bell */}
        <div className="flex-shrink-0">
          {token.hasAlert ? (
            <BellRing className="w-5 h-5 text-orange-400 animate-wiggle" />
          ) : (
            <Bell className="w-5 h-5 text-slate-500" />
          )}
        </div>

        {/* Actions Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
        >
          <ChevronRight
            className={cn(
              "w-4 h-4 transition-transform",
              showActions && "rotate-90"
            )}
          />
        </Button>
      </div>

      {/* Quick Actions */}
      {showActions && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-transparent border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50"
            onClick={(e) => {
              e.stopPropagation();
              onScan();
            }}
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Scan Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

// Empty State Component
function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
        <EyeOff className="w-20 h-20 text-slate-600 relative" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        Sua lista esta vazia
      </h3>
      <p className="text-slate-400 text-center mb-6 max-w-sm">
        Comece a monitorar tokens suspeitos e receba alertas quando o risco
        mudar.
      </p>
      <Button
        className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400"
        onClick={onExplore}
      >
        <Eye className="w-4 h-4 mr-2" />
        Explorar Tokens
      </Button>
    </div>
  );
}

// Skeleton Loading Component
function WatchlistSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 animate-pulse">
            {/* Avatar Skeleton */}
            <div className="w-12 h-12 rounded-full bg-white/10" />

            {/* Info Skeleton */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-24" />
              <div className="h-3 bg-white/10 rounded w-16" />
            </div>

            {/* Sparkline Skeleton */}
            <div className="hidden sm:block w-[60px] h-6 bg-white/10 rounded" />

            {/* Score Skeleton */}
            <div className="w-10 h-10 rounded-full bg-white/10" />

            {/* Bell Skeleton */}
            <div className="w-5 h-5 rounded bg-white/10" />

            {/* Chevron Skeleton */}
            <div className="w-8 h-8 rounded bg-white/10" />
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
  onTokenClick,
}: WatchlistProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToken = () => {
    if (onAddToken) {
      onAddToken();
    } else {
      router.push("/");
    }
  };

  const handleScanToken = (tokenId: string) => {
    if (onScanToken) {
      onScanToken(tokenId);
    }
  };

  const handleRemoveToken = (tokenId: string) => {
    if (onRemoveToken) {
      onRemoveToken(tokenId);
    }
  };

  const handleTokenClick = (tokenId: string) => {
    if (onTokenClick) {
      onTokenClick(tokenId);
    } else {
      router.push(`/finding/${tokenId}`);
    }
  };

  const handleExplore = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-page/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Watchlist</h1>
              {tokens.length > 0 && (
                <span className="px-2.5 py-1 text-xs font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                  {tokens.length} Tokens
                </span>
              )}
            </div>
            <Button
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full",
                "bg-gradient-to-r from-cyan-500 to-blue-500",
                "hover:from-cyan-400 hover:to-blue-400",
                "shadow-lg shadow-cyan-500/30"
              )}
              onClick={handleAddToken}
            >
              <Plus className="w-5 h-5 text-white" />
            </Button>
          </div>

          {/* Search Bar */}
          {tokens.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2.5",
                  "bg-white/5 backdrop-blur-xl",
                  "border border-white/10 rounded-xl",
                  "text-white placeholder:text-slate-500",
                  "focus:outline-none focus:border-cyan-500/50",
                  "transition-colors"
                )}
              />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <WatchlistSkeleton />
        ) : tokens.length === 0 ? (
          <EmptyState onExplore={handleExplore} />
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              Nenhum token encontrado para "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTokens.map((token) => (
              <TokenCard
                key={token.id}
                token={token}
                onScan={() => handleScanToken(token.id)}
                onRemove={() => handleRemoveToken(token.id)}
                onClick={() => handleTokenClick(token.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Default export with mock data for demo
export default function WatchlistDemo() {
  const [tokens, setTokens] = useState<WatchlistToken[]>([
    {
      id: "bonk",
      name: "Bonk",
      symbol: "BONK",
      logoUrl: "/images/bags-token-icon.jpg",
      price: 0.00002341,
      priceChange24h: 12.5,
      shieldScore: 88,
      previousScore: 85,
      hasAlert: true,
      sparklineData: [20, 22, 21, 25, 28, 26, 30, 32, 35, 33],
    },
    {
      id: "wif",
      name: "dogwifhat",
      symbol: "WIF",
      logoUrl: "/images/bags-token-icon.jpg",
      price: 2.45,
      priceChange24h: -3.2,
      shieldScore: 72,
      hasAlert: false,
      sparklineData: [40, 38, 35, 36, 32, 30, 28, 25, 27, 26],
    },
    {
      id: "jup",
      name: "Jupiter",
      symbol: "JUP",
      logoUrl: "/images/bags-token-icon.jpg",
      price: 1.23,
      priceChange24h: 5.8,
      shieldScore: 94,
      hasAlert: false,
      sparklineData: [50, 52, 55, 58, 56, 60, 62, 65, 68, 70],
    },
    {
      id: "ray",
      name: "Raydium",
      symbol: "RAY",
      logoUrl: "/images/bags-token-icon.jpg",
      price: 4.67,
      priceChange24h: -1.5,
      shieldScore: 45,
      previousScore: 65,
      hasAlert: true,
      sparklineData: [80, 75, 70, 68, 65, 60, 55, 50, 48, 45],
    },
    {
      id: "orca",
      name: "Orca",
      symbol: "ORCA",
      logoUrl: "/images/bags-token-icon.jpg",
      price: 3.89,
      priceChange24h: 8.2,
      shieldScore: 82,
      hasAlert: false,
      sparklineData: [30, 32, 35, 38, 40, 42, 45, 48, 50, 52],
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const handleRemoveToken = (tokenId: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  };

  const handleScanToken = (tokenId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  return (
    <Watchlist
      tokens={tokens}
      isLoading={isLoading}
      onRemoveToken={handleRemoveToken}
      onScanToken={handleScanToken}
    />
  );
}
