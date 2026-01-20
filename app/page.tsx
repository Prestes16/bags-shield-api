"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, Clock, Bell, Activity, Settings, Home } from "lucide-react";
import { ShieldScore } from "@/components/bags-shield/shield-score";
import {
  StatusBadge,
  type BadgeStatus,
} from "@/components/bags-shield/status-badge";
import { SkeletonLoading } from "@/components/bags-shield/skeleton-loading";
import { RateLimitedCard } from "@/components/bags-shield/rate-limited-card";
import { ActionToolbar } from "@/components/bags-shield/action-toolbar";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTheme } from "@/lib/theme/theme-context";

type ViewState = "loading" | "rate-limited" | "result";

// Mock data - easily replaceable with API data
const mockTokenData = {
  name: "BAGS",
  address: "8zCmrX3Xtq7fK9pN2wLm5JvH4cRn6sYa8dBt1eQu3Xtq",
  logoUrl: "/images/bags-token-icon.jpg",
  score: 86,
  grade: "A",
};

const mockBadges: { id: string; label: string; status: BadgeStatus; hasDetails: boolean }[] =
  [
    { id: "liquidity-locked", label: "Liquidity Locked", status: "ok", hasDetails: true },
    { id: "freeze-authority", label: "Freeze Authority Present", status: "attention", hasDetails: true },
    { id: "mint-authority", label: "Mint Authority Renounced", status: "ok", hasDetails: true },
    { id: "top-holders", label: "Top Holders 28%", status: "high", hasDetails: true },
    { id: "metadata-verified", label: "Metadata Verified", status: "ok", hasDetails: true },
    { id: "anomalies", label: "Anomalies: None", status: "ok", hasDetails: true },
  ];

const mockLiquidityRoute = {
  status: "Stable",
};

export default function ScanResultPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [viewState, setViewState] = useState<ViewState>("result");
  const truncatedAddress = `${mockTokenData.address.slice(0, 5)}...${mockTokenData.address.slice(-4)}`;
  
  // Translated badges
  const translatedBadges = [
    { id: "liquidity-locked", label: t.scan.liquidityLocked, status: "ok" as BadgeStatus, hasDetails: true },
    { id: "freeze-authority", label: t.scan.freezeAuthority, status: "attention" as BadgeStatus, hasDetails: true },
    { id: "mint-authority", label: t.scan.mintAuthority, status: "ok" as BadgeStatus, hasDetails: true },
    { id: "top-holders", label: `${t.scan.topHolders} 28%`, status: "high" as BadgeStatus, hasDetails: true },
    { id: "metadata-verified", label: t.scan.metadataVerified, status: "ok" as BadgeStatus, hasDetails: true },
    { id: "anomalies", label: `${t.scan.anomalies}: ${t.scan.none}`, status: "ok" as BadgeStatus, hasDetails: true },
  ];

  const handleDetailsClick = (findingId: string) => {
    router.push(`/finding/${findingId}`);
  };

  // Demo: Toggle between states
  const handleScanAgain = () => {
    setViewState("loading");
    setTimeout(() => {
      // Simulate occasional rate limit
      if (Math.random() > 0.7) {
        setViewState("rate-limited");
      } else {
        setViewState("result");
      }
    }, 2000);
  };

  const handleRetry = () => {
    setViewState("loading");
    setTimeout(() => setViewState("result"), 1500);
  };

  const handleSimulate = () => {
    router.push("/simulate");
  };

  // Render based on state
  if (viewState === "loading") {
    return <SkeletonLoading />;
  }

  if (viewState === "rate-limited") {
    return <RateLimitedCard initialSeconds={15} onRetry={handleRetry} />;
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary flex flex-col transition-colors duration-300">
      {/* Mobile Status Bar Simulation */}
      <div className="flex items-center justify-between px-6 py-2 text-text-primary text-sm">
        <span className="font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21c-1.654 0-3-1.346-3-3h6c0 1.654-1.346 3-3 3zm-7.5-3h15l-1.5-1.5V12c0-3.037-2.14-5.585-5-6.32V4.5c0-.828-.672-1.5-1.5-1.5s-1.5.672-1.5 1.5v1.18C8.14 6.415 6 8.963 6 12v4.5L4.5 18z" />
          </svg>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
          <svg className="w-6 h-3" fill="currentColor" viewBox="0 0 24 12">
            <rect
              x="0"
              y="0"
              width="22"
              height="12"
              rx="2"
              ry="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <rect x="22" y="4" width="2" height="4" rx="1" ry="1" />
            <rect x="2" y="2" width="16" height="8" rx="1" ry="1" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <header className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
            <svg
              className="w-5 h-5 text-cyan-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
          </div>
          <span className="text-text-primary font-semibold tracking-wide">
            BAGS SHIELD
          </span>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/watchlist")}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-bg-card-hover hover:border-cyan-500/30 transition-all"
            title="Watchlist"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/history")}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-bg-card-hover hover:border-cyan-500/30 transition-all"
            title="Historico"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/alerts")}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-bg-card-hover hover:border-cyan-500/30 transition-all"
            title="Alertas"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/network")}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-bg-card-hover hover:border-cyan-500/30 transition-all"
            title="Network Status"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-bg-card-hover hover:border-cyan-500/30 transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 pb-6 flex flex-col">
        {/* Token Info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-full blur-lg" />
            <Image
              src={mockTokenData.logoUrl || "/placeholder.svg"}
              alt={`${mockTokenData.name} logo`}
              width={56}
              height={56}
              className="rounded-full relative z-10"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {mockTokenData.name}
            </h1>
            <p className="text-text-muted font-mono text-sm">
              {truncatedAddress}
            </p>
          </div>
        </div>

        {/* Shield Score */}
        <div className="flex justify-center mb-6">
          <ShieldScore score={mockTokenData.score} grade={mockTokenData.grade} />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {translatedBadges.map((badge) => (
            <StatusBadge
              key={badge.id}
              label={badge.label}
              status={badge.status}
              details={badge.hasDetails ? t.common.details : undefined}
              onDetailsClick={() => handleDetailsClick(badge.id)}
            />
          ))}
        </div>

        {/* Liquidity Route */}
        <div className="bg-bg-card backdrop-blur-sm rounded-xl px-4 py-3 mb-4 border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-text-primary text-sm">
              {t.scan.liquidityRoute}:{" "}
              <span className="font-medium text-cyan-400">
                {t.scan.stable}
              </span>
            </span>
            <button
              type="button"
              className="text-text-muted text-xs hover:text-cyan-400 transition-colors"
            >
              {t.common.details}
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="mb-4">
          <ActionToolbar
            mintAddress={mockTokenData.address}
            onScanAgain={handleScanAgain}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSimulate}
            className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/25"
          >
            {t.scan.connectWallet}
          </button>

          <button
            type="button"
            onClick={() => setViewState("loading")}
            className="w-full py-3 rounded-xl font-medium text-text-secondary bg-bg-card hover:bg-bg-card-hover transition-all duration-300 border border-border-subtle"
          >
            {t.scan.shareReport}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-4">
          {t.scan.dataDisclaimer}
        </p>

        {/* Home Indicator */}
        <div className="flex justify-center mt-4">
          <div className="w-32 h-1 bg-slate-700 rounded-full" />
        </div>
      </main>
    </div>
  );
}
