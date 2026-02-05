"use client";

import React from "react"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Activity,
  Wifi,
  Server,
  Database,
  Cpu,
  CheckCircle,
  AlertCircle,
  XCircle,
  Zap,
  Clock,
  BarChart3,
  Terminal,
} from "lucide-react";

type NetworkHealth = "healthy" | "degraded" | "down";
type ServiceStatus = "operational" | "degraded" | "offline";

interface NetworkMetrics {
  tps: number;
  tpsHistory: number[];
  latency: number;
  epochProgress: number;
  currentEpoch: number;
  slotHeight: number;
  health: NetworkHealth;
}

interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  icon: React.ReactNode;
}

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning";
}

// Skeleton Loading Component
function SkeletonLoading() {
  return (
    <div className="min-h-screen bg-bg-page text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="h-7 w-48 bg-white/10 rounded-lg animate-pulse" />
        </div>

        {/* Pulse Indicator Skeleton */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-white/10 animate-pulse" />
        </div>

        {/* Metrics Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
            />
          ))}
        </div>

        {/* Services Skeleton */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6 animate-pulse">
          <div className="h-5 w-40 bg-white/10 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/10 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Log Skeleton */}
        <div className="h-48 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
      </div>
    </div>
  );
}

export function NetworkStatus() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    tps: 2547,
    tpsHistory: [2100, 2300, 2450, 2200, 2500, 2350, 2547],
    latency: 458,
    epochProgress: 72,
    currentEpoch: 592,
    slotHeight: 284729481,
    health: "healthy",
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  const services: ServiceInfo[] = [
    {
      name: "Scanner Engine",
      status: "operational",
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      name: "Simulation Node",
      status: "operational",
      icon: <Server className="w-4 h-4" />,
    },
    {
      name: "Risk Database",
      status: "operational",
      icon: <Database className="w-4 h-4" />,
    },
  ];

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Simulate real-time metrics updates
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      setMetrics((prev) => {
        const newTps = Math.floor(prev.tps + (Math.random() - 0.5) * 200);
        const clampedTps = Math.max(1800, Math.min(3500, newTps));
        const newHistory = [...prev.tpsHistory.slice(1), clampedTps];
        const newLatency = Math.floor(prev.latency + (Math.random() - 0.5) * 50);
        const clampedLatency = Math.max(200, Math.min(800, newLatency));
        const newSlot = prev.slotHeight + Math.floor(Math.random() * 3) + 1;
        const newEpochProgress = Math.min(100, prev.epochProgress + 0.01);

        return {
          ...prev,
          tps: clampedTps,
          tpsHistory: newHistory,
          latency: clampedLatency,
          slotHeight: newSlot,
          epochProgress: newEpochProgress > 99.9 ? 0 : newEpochProgress,
          health: clampedLatency > 600 ? "degraded" : "healthy",
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Simulate log entries
  useEffect(() => {
    if (isLoading) return;

    const logMessages = [
      { message: "Block confirmed", type: "success" as const },
      { message: "Validator sync complete", type: "success" as const },
      { message: "New slot processed", type: "info" as const },
      { message: "Transaction batch verified", type: "info" as const },
      { message: "RPC health check passed", type: "success" as const },
      { message: "Epoch boundary approaching", type: "warning" as const },
    ];

    const addLog = () => {
      const randomLog = logMessages[Math.floor(Math.random() * logMessages.length)];
      const now = new Date();
      const timestamp = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setLogs((prev) => {
        const newLogs = [
          ...prev,
          {
            id: logIdRef.current++,
            timestamp,
            message: `${randomLog.message} #${metrics.slotHeight}`,
            type: randomLog.type,
          },
        ];
        return newLogs.slice(-20); // Keep last 20 logs
      });
    };

    // Add initial logs
    for (let i = 0; i < 5; i++) {
      setTimeout(() => addLog(), i * 200);
    }

    const interval = setInterval(addLog, 3000);
    return () => clearInterval(interval);
  }, [isLoading, metrics.slotHeight]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const getHealthColor = (health: NetworkHealth) => {
    switch (health) {
      case "healthy":
        return "from-emerald-400 to-green-500";
      case "degraded":
        return "from-amber-400 to-orange-500";
      case "down":
        return "from-red-400 to-rose-500";
    }
  };

  const getHealthGlow = (health: NetworkHealth) => {
    switch (health) {
      case "healthy":
        return "rgba(34, 197, 94, 0.4)";
      case "degraded":
        return "rgba(251, 191, 36, 0.4)";
      case "down":
        return "rgba(239, 68, 68, 0.4)";
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "degraded":
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case "offline":
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusText = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "offline":
        return "Offline";
    }
  };

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "text-emerald-400";
      case "degraded":
        return "text-amber-400";
      case "offline":
        return "text-red-400";
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-emerald-400";
      case "warning":
        return "text-amber-400";
      default:
        return "text-slate-400";
    }
  };

  // Mini sparkline chart
  const renderSparkline = (data: number[]) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 100;
    const height = 40;

    const points = data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(6, 182, 212, 0.3)" />
            <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill="url(#sparklineGradient)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (isLoading) {
    return <SkeletonLoading />;
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Solana Network Health</h1>
            <p className="text-xs text-text-muted">Monitoramento em tempo real</p>
          </div>
        </div>

        {/* Global Pulse Indicator */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="relative">
            {/* Pulse Rings */}
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-r ${getHealthColor(metrics.health)} opacity-20 animate-ping`}
              style={{ animationDuration: "2s" }}
            />
            <div
              className={`absolute inset-2 rounded-full bg-gradient-to-r ${getHealthColor(metrics.health)} opacity-30 animate-ping`}
              style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
            />
            {/* Main Circle */}
            <div
              className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${getHealthColor(metrics.health)} flex items-center justify-center`}
              style={{ boxShadow: `0 0 40px ${getHealthGlow(metrics.health)}` }}
            >
              <Activity className="w-10 h-10 text-white" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Status:{" "}
            <span
              className={`font-semibold ${metrics.health === "healthy" ? "text-emerald-400" : metrics.health === "degraded" ? "text-amber-400" : "text-red-400"}`}
            >
              {metrics.health === "healthy"
                ? "Saudavel"
                : metrics.health === "degraded"
                  ? "Degradado"
                  : "Offline"}
            </span>
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* TPS Card */}
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">TPS</span>
            </div>
            <div className="flex items-end justify-between">
              <span
                className="text-2xl font-bold text-white tabular-nums transition-all duration-300"
                key={metrics.tps}
              >
                {metrics.tps.toLocaleString()}
              </span>
            </div>
            <div className="mt-3">{renderSparkline(metrics.tpsHistory)}</div>
          </div>

          {/* Latency Card */}
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Latency</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-2xl font-bold tabular-nums transition-all duration-300 ${metrics.latency > 600 ? "text-amber-400" : "text-white"}`}
                key={metrics.latency}
              >
                {metrics.latency}
              </span>
              <span className="text-sm text-slate-500">ms</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${metrics.latency > 600 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (metrics.latency / 1000) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">1s</span>
            </div>
          </div>

          {/* Epoch Progress Card */}
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Epoch {metrics.currentEpoch}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white tabular-nums">
                {metrics.epochProgress.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">%</span>
            </div>
            <div className="mt-3">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.epochProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Slot Height Card */}
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Slot Height</span>
            </div>
            <span
              className="text-xl font-bold text-white font-mono tabular-nums block transition-all duration-300"
              key={metrics.slotHeight}
            >
              {metrics.slotHeight.toLocaleString()}
            </span>
            <p className="mt-2 text-xs text-slate-500">Atualizado em tempo real</p>
          </div>
        </div>

        {/* Internal Services Status */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Bags Shield Services
          </h2>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                    {service.icon}
                  </div>
                  <span className="text-sm text-white">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  <span className={`text-xs font-medium ${getStatusColor(service.status)}`}>
                    {getStatusText(service.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Validator Log */}
        <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-white">Live Validator Log</span>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500">Live</span>
            </div>
          </div>
          <div
            ref={logRef}
            className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <span className="text-slate-600">[{log.timestamp}]</span>
                <span className={getLogColor(log.type)}>{log.message}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 text-slate-600">
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
