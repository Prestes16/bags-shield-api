"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getScanHistory, type ScanHistoryItem } from "@/lib/scan-history";
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
  AlertTriangle,
  ShieldAlert,
  Home,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import { BottomNav } from "@/components/ui/bottom-nav";

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
  hasScanned?: boolean; // Indicates if item has been scanned
  isScamHistory?: boolean; // Indicates frozen scam record from history
}



// Helper functions
function getRelativeTime(date: Date, t: any): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return t.history.justNow || "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return t.history.yesterday || "Yesterday";
  return `${diffDays}d ago`;
}

function getTypeLabel(type: ActivityType, t: any): string {
  switch (type) {
    case "scan":
      return "Scan";
    case "simulation":
      return "Simulation";
    case "transaction":
      return "Transaction";
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

// Filter tabs
type FilterTab = "all" | "scans" | "simulations" | "transactions";

// Skeleton Loading Component
function HistorySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border-subtle"
        >
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-muted rounded animate-pulse flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Empty State Component
function EmptyState({ onNewScan, t }: { onNewScan: () => void; t: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-[var(--cyan-primary)]/10 blur-3xl rounded-full" />
        <div className="relative p-6 rounded-full bg-bg-card border border-border-subtle">
          <Ghost className="w-12 h-12 text-text-muted" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {t.history.emptyTitle}
      </h3>
      <p className="text-sm text-text-muted text-center mb-6 max-w-xs">
        {t.history.emptyDescription}
      </p>

      <button
        type="button"
        onClick={onNewScan}
className="px-6 py-3 rounded-xl border border-[var(--cyan-primary)]/50 text-[var(--cyan-primary)] font-medium
                hover:bg-[var(--cyan-primary)]/10 active:scale-98 transition-all flex items-center gap-2"
      >
        <ScanSearch className="w-4 h-4" />
        {t.history.startScan}
      </button>
    </div>
  );
}

// Activity Card Component
function ActivityCard({
  activity,
  onClick,
  onScanNow,
  t,
}: {
  activity: Activity;
  onClick: () => void;
  onScanNow: (activity: Activity) => void;
  t: any;
}) {
  const TypeIcon = getTypeIcon(activity.type);
  const hasScore = activity.score !== undefined && activity.hasScanned;
  const showScanButton = !activity.hasScanned && activity.type === "scan";
  const isScamHistory = activity.isScamHistory && activity.hasScanned;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl",
        "bg-bg-card border border-border-subtle",
        "hover:bg-bg-card-hover transition-all"
      )}
    >
      {/* Left: Icon */}
      <div className="relative flex-shrink-0">
        {activity.tokenLogo ? (
          <Image
            src={activity.tokenLogo || "/placeholder.svg"}
            alt={activity.tokenSymbol}
            width={40}
            height={40}
            className="rounded-full bg-muted"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <TypeIcon className="w-5 h-5 text-text-muted" />
          </div>
        )}
        {/* Type indicator badge */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
            "bg-bg-page border border-border-subtle"
          )}
        >
          <TypeIcon className="w-2.5 h-2.5 text-text-muted" />
        </div>
      </div>

      {/* Middle: Text content */}
      <button
        type="button"
        onClick={showScanButton ? undefined : onClick}
        disabled={showScanButton}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-text-primary truncate">
            {activity.tokenName}
          </span>
          {activity.status === "fail" && activity.type === "scan" && activity.hasScanned && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
          <span>{getRelativeTime(activity.timestamp, t)}</span>
          <span>•</span>
          <span className="truncate">{getTypeLabel(activity.type, t)}</span>
          {isScamHistory && (
            <>
              <span>•</span>
              <span className="text-red-400 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Scam history
              </span>
            </>
          )}
        </div>
      </button>

      {/* Right: Status or action */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {showScanButton ? (
          // Show "Not scanned" chip + Scan button
          <>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-text-muted border border-border-subtle whitespace-nowrap">
              Not scanned
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onScanNow(activity);
              }}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white text-xs font-semibold hover:shadow-[0_0_12px_var(--cyan-glow)] active:scale-95 transition-all"
            >
              <ScanSearch className="w-3 h-3" />
              <span>Scan now</span>
            </button>
          </>
        ) : hasScore ? (
          // Show score badge (only if scanned)
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md border whitespace-nowrap",
                getScoreColor(activity.score!)
              )}
            >
              {activity.grade} {activity.score}
            </span>
            <button
              type="button"
              onClick={onClick}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : activity.type === "simulation" && activity.hasScanned ? (
          // Show pass/fail for simulation
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md border whitespace-nowrap",
                activity.status === "pass"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              )}
            >
              {activity.status === "pass" ? "Pass" : "Fail"}
            </span>
            <button
              type="button"
              onClick={onClick}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : activity.type === "transaction" ? (
          // Show confirmed/pending for transaction
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md border whitespace-nowrap",
                activity.status === "confirmed"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              )}
            >
              {activity.status === "confirmed" ? "Done" : "Pending"}
            </span>
            <button
              type="button"
              onClick={onClick}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Convert scan history to activities
function convertScanHistoryToActivities(scans: ScanHistoryItem[]): Activity[] {
  return scans.map((scan, index) => ({
    id: `scan-${scan.mint}-${scan.timestamp}`,
    type: "scan" as ActivityType,
    tokenName: scan.tokenName,
    tokenSymbol: scan.tokenSymbol,
    mintAddress: scan.mint,
    timestamp: new Date(scan.timestamp),
    status: scan.isSafe ? ("pass" as ActivityStatus) : ("fail" as ActivityStatus),
    score: scan.score,
    grade: scan.grade,
    hasScanned: true,
    isScamHistory: !scan.isSafe && scan.score < 30,
  }));
}

// Main Component
interface ActivityHistoryProps {
  isLoading?: boolean;
}

export function ActivityHistory({
  isLoading: initialLoading = false,
}: ActivityHistoryProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(initialLoading);

  // Load real scan history from localStorage
  useEffect(() => {
    const loadHistory = () => {
      setIsLoading(true);
      try {
        const scanHistory = getScanHistory();
        const convertedActivities = convertScanHistoryToActivities(scanHistory);
        setActivities(convertedActivities);
      } catch (error) {
        console.error("[v0] Failed to load history:", error);
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
    
    // Reload when window regains focus (in case history was updated in another tab)
    const handleFocus = () => loadHistory();
    window.addEventListener("focus", handleFocus);
    
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const filterTabs: { id: FilterTab; label: string; icon: typeof ScanSearch }[] = [
    { id: "all", label: t.history.all, icon: History },
    { id: "scans", label: t.history.scans, icon: ScanSearch },
    { id: "simulations", label: t.history.simulations, icon: Zap },
    { id: "transactions", label: t.history.transactions, icon: CheckCircle },
  ];

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
    if (activity.type === "scan" && activity.hasScanned) {
      router.push(`/scan?address=${activity.mintAddress}`);
    } else if (activity.type === "simulation") {
      router.push("/simulate/result");
    } else if (activity.type === "transaction") {
      router.push("/progress");
    }
  };

  const handleScanNow = (activity: Activity) => {
    router.push(`/scan?address=${activity.mintAddress}`);
  };

  const handleNewScan = () => {
    router.push("/scan");
  };

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Container */}
      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-11 h-11 rounded-xl bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-text-primary">{t.history.title}</h1>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.history.searchPlaceholder}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-bg-input border border-border-subtle
                         text-text-primary placeholder:text-text-muted text-sm
                         focus:outline-none focus:ring-2 focus:ring-[var(--cyan-primary)]/50 focus:border-[var(--cyan-primary)]/50
                         transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                      : "bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity List */}
        {isLoading ? (
          <HistorySkeleton />
        ) : filteredActivities.length === 0 ? (
          <EmptyState onNewScan={handleNewScan} t={t} />
        ) : (
          <div className="space-y-2">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onClick={() => handleActivityClick(activity)}
                onScanNow={handleScanNow}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Results count */}
        {!isLoading && filteredActivities.length > 0 && (
          <div className="mt-4 text-center text-xs text-text-muted">
            {filteredActivities.length}{" "}
            {filteredActivities.length === 1
              ? t.history.activity || "activity"
              : t.history.activities || "activities"}
          </div>
        )}
      </div>

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
