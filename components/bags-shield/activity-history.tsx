"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  History,
  ScanSearch,
  Zap,
  CheckCircle,
  Ghost,
  ArrowRightLeft,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

// Types
type ActivityType = "scan" | "simulation" | "transaction";
type ActivityStatus = "pass" | "fail" | "confirmed" | "pending";

interface Activity {
  id: string;
  type: ActivityType;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  mintAddress: string;
  timestamp: Date;
  status: ActivityStatus;
  score?: number;
  grade?: string;
  description?: string;
}

// Mock data
const mockActivities: Activity[] = [
  {
    id: "1",
    type: "scan",
    tokenName: "BONK",
    tokenSymbol: "BONK",
    tokenLogo: "/images/bags-token-icon.jpg",
    mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    status: "pass",
    score: 85,
    grade: "B",
  },
  {
    id: "2",
    type: "simulation",
    tokenName: "Swap SOL → USDC",
    tokenSymbol: "SOL",
    mintAddress: "So11111111111111111111111111111111111111112",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    status: "pass",
    description: "1.5 SOL → 245.32 USDC",
  },
  {
    id: "3",
    type: "transaction",
    tokenName: "Buy BAGS",
    tokenSymbol: "BAGS",
    tokenLogo: "/images/bags-token-icon.jpg",
    mintAddress: "8zCmrX3Xtq7fK9pN2wLm5JvH4cRn6sYa8dBt1eQu3Xtq",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    status: "confirmed",
    description: "0.5 SOL → 12,450 BAGS",
  },
  {
    id: "4",
    type: "scan",
    tokenName: "POPCAT",
    tokenSymbol: "POPCAT",
    mintAddress: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "fail",
    score: 45,
    grade: "D",
  },
  {
    id: "5",
    type: "simulation",
    tokenName: "Swap BONK → SOL",
    tokenSymbol: "BONK",
    tokenLogo: "/images/bags-token-icon.jpg",
    mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    status: "fail",
    description: "High slippage detected",
  },
  {
    id: "6",
    type: "transaction",
    tokenName: "Revoke Authority",
    tokenSymbol: "AUTH",
    mintAddress: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "confirmed",
    description: "Mint authority revoked",
  },
];

// Helper functions
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return "Ontem";
  return `${diffDays} dias atrás`;
}

function getTypeLabel(type: ActivityType): string {
  switch (type) {
    case "scan":
      return "Scan";
    case "simulation":
      return "Simulação";
    case "transaction":
      return "Transação";
  }
}

function getTypeIcon(type: ActivityType) {
  switch (type) {
    case "scan":
      return ScanSearch;
    case "simulation":
      return Zap;
    case "transaction":
      return ArrowRightLeft;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (score >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

function getStatusBadge(activity: Activity) {
  if (activity.type === "scan" && activity.score !== undefined) {
    return (
      <span
        className={cn(
          "px-2 py-0.5 text-xs font-semibold rounded border",
          getScoreColor(activity.score)
        )}
      >
        {activity.grade} - {activity.score}
      </span>
    );
  }

  if (activity.type === "simulation") {
    return (
      <span
        className={cn(
          "px-2 py-0.5 text-xs font-semibold rounded border",
          activity.status === "pass"
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            : "bg-red-500/20 text-red-400 border-red-500/30"
        )}
      >
        {activity.status === "pass" ? "Pass" : "Fail"}
      </span>
    );
  }

  if (activity.type === "transaction") {
    return (
      <span
        className={cn(
          "px-2 py-0.5 text-xs font-semibold rounded border",
          activity.status === "confirmed"
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        )}
      >
        {activity.status === "confirmed" ? "Confirmed" : "Pending"}
      </span>
    );
  }

  return null;
}

function getBorderColor(type: ActivityType): string {
  switch (type) {
    case "scan":
      return "border-l-blue-500";
    case "simulation":
      return "border-l-violet-500";
    case "transaction":
      return "border-l-emerald-500";
  }
}

// Filter tabs
type FilterTab = "all" | "scans" | "simulations" | "transactions";

const filterTabs: { id: FilterTab; label: string; icon: typeof ScanSearch }[] = [
  { id: "all", label: "All", icon: History },
  { id: "scans", label: "Scans", icon: ScanSearch },
  { id: "simulations", label: "Sims", icon: Zap },
  { id: "transactions", label: "Txns", icon: CheckCircle },
];

// Skeleton Loading Component
function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
        >
          {/* Avatar skeleton */}
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />

          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
          </div>

          {/* Badge skeleton */}
          <div className="h-6 w-16 bg-white/10 rounded animate-pulse" />
          <div className="w-4 h-4 bg-white/5 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Empty State Component
function EmptyState({ onNewScan }: { onNewScan: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full" />
        <div className="relative p-6 rounded-full bg-white/5 border border-white/10">
          <Ghost className="w-12 h-12 text-slate-500" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        Nenhuma atividade recente
      </h3>
      <p className="text-sm text-slate-400 text-center mb-6 max-w-xs">
        Comece analisando um token para ver seu historico de atividades aqui.
      </p>

      <button
        onClick={onNewScan}
        className="px-6 py-3 rounded-xl border border-cyan-500/50 text-cyan-400 font-medium
                   hover:bg-cyan-500/10 transition-all duration-200 flex items-center gap-2"
      >
        <ScanSearch className="w-4 h-4" />
        Iniciar novo Scan
      </button>
    </div>
  );
}

// Activity Card Component
function ActivityCard({
  activity,
  onClick,
}: {
  activity: Activity;
  onClick: () => void;
}) {
  const TypeIcon = getTypeIcon(activity.type);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-xl",
        "bg-white/5 border border-white/10 border-l-2",
        getBorderColor(activity.type),
        "hover:bg-white/[0.07] transition-all duration-200",
        "text-left group"
      )}
    >
      {/* Avatar / Icon */}
      <div className="relative flex-shrink-0">
        {activity.tokenLogo ? (
          <Image
            src={activity.tokenLogo || "/placeholder.svg"}
            alt={activity.tokenSymbol}
            width={40}
            height={40}
            className="rounded-full bg-slate-800"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <TypeIcon className="w-5 h-5 text-slate-400" />
          </div>
        )}
        {/* Type indicator */}
        <div
          className={cn(
            "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center",
            "bg-slate-900 border border-slate-700"
          )}
        >
          <TypeIcon className="w-3 h-3 text-slate-400" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {activity.tokenName}
          </span>
          {activity.status === "fail" && activity.type === "scan" && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>{getRelativeTime(activity.timestamp)}</span>
          <span>•</span>
          <span>{getTypeLabel(activity.type)}</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {getStatusBadge(activity)}
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </button>
  );
}

// Main Component
interface ActivityHistoryProps {
  activities?: Activity[];
  isLoading?: boolean;
}

export function ActivityHistory({
  activities = mockActivities,
  isLoading = false,
}: ActivityHistoryProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // Filter activities
  const filteredActivities = useMemo(() => {
    let result = activities;

    // Filter by type
    if (activeFilter !== "all") {
      const typeMap: Record<FilterTab, ActivityType | null> = {
        all: null,
        scans: "scan",
        simulations: "simulation",
        transactions: "transaction",
      };
      const filterType = typeMap[activeFilter];
      if (filterType) {
        result = result.filter((a) => a.type === filterType);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.tokenName.toLowerCase().includes(query) ||
          a.tokenSymbol.toLowerCase().includes(query) ||
          a.mintAddress.toLowerCase().includes(query)
      );
    }

    return result;
  }, [activities, activeFilter, searchQuery]);

  const handleActivityClick = (activity: Activity) => {
    if (activity.type === "scan") {
      router.push(`/finding/${activity.id}`);
    } else if (activity.type === "simulation") {
      router.push("/simulate/result");
    } else {
      router.push("/progress");
    }
  };

  const handleNewScan = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Container */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-white">{t.history.title}</h1>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.history.searchPlaceholder}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 text-sm
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                         transition-all duration-200"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-blue-500 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity List */}
        {isLoading ? (
          <HistorySkeleton />
        ) : filteredActivities.length === 0 ? (
          <EmptyState onNewScan={handleNewScan} />
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onClick={() => handleActivityClick(activity)}
              />
            ))}
          </div>
        )}

        {/* Results count */}
        {!isLoading && filteredActivities.length > 0 && (
          <div className="mt-4 text-center text-xs text-slate-500">
            {filteredActivities.length}{" "}
            {filteredActivities.length === 1 ? "atividade" : "atividades"}
          </div>
        )}
      </div>
    </div>
  );
}
