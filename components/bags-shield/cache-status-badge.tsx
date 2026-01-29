"use client";

import { AlertCircle, Zap, Clock } from "lucide-react";

export type CacheStatus = "live" | "cached" | "stale" | "degraded";

interface CacheStatusBadgeProps {
  status: CacheStatus;
  fromCache?: boolean;
  stale?: boolean;
}

export function CacheStatusBadge({
  status,
  fromCache,
  stale,
}: CacheStatusBadgeProps) {
  const getStatusInfo = () => {
    if (stale) return { label: "STALE", color: "amber", icon: Clock };
    if (fromCache) return { label: "CACHED", color: "cyan", icon: Zap };
    if (status === "degraded")
      return { label: "DEGRADED", color: "orange", icon: AlertCircle };
    return { label: "LIVE", color: "emerald", icon: Zap };
  };

  const info = getStatusInfo();
  const Icon = info.icon;

  const colorClasses: Record<string, string> = {
    live: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    cached: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    stale: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    degraded: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${
        colorClasses[info.color]
      }`}
    >
      <Icon className="w-3 h-3" />
      <span>{info.label}</span>
    </div>
  );
}
