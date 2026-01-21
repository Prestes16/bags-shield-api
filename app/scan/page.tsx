"use client";

import React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Home, Search } from "lucide-react";
import { ShieldScore } from "@/components/bags-shield/shield-score";
import {
  StatusBadge,
  type BadgeStatus,
} from "@/components/bags-shield/status-badge";
import { SkeletonLoading } from "@/components/bags-shield/skeleton-loading";
import { RateLimitedCard } from "@/components/bags-shield/rate-limited-card";
import { ActionToolbar } from "@/components/bags-shield/action-toolbar";
import { useLanguage } from "@/lib/i18n/language-context";

type ViewState = "loading" | "rate-limited" | "result";

// Mock data - easily replaceable with API data
const mockTokenData = {
  name: "BAGS",
  address: "8zCmrX3Xtq7fK9pN2wLm5JvH4cRn6sYa8dBt1eQu3Xtq",
  logoUrl: "/images/bags-token-icon.jpg",
  score: 86,
  grade: "A",
};

const Loading = () => null;

export default function ScanResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [viewState, setViewState] = useState<ViewState>("result");
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleScanAgain = () => {
    setViewState("loading");
    setTimeout(() => {
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setViewState("loading");
      setTimeout(() => setViewState("result"), 2000);
    }
  };

  if (viewState === "loading") {
    return <SkeletonLoading />;
  }

  if (viewState === "rate-limited") {
    return <RateLimitedCard initialSeconds={15} onRetry={handleRetry} />;
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary flex flex-col w-full overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-page/95 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
                <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-text-primary">Scan Result</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-cyan-400 transition-all"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.history.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-card border border-border-subtle text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
            />
          </form>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 px-4 py-4 overflow-y-auto">
        {/* Token Info */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-full blur-lg" />
            <Image
              src={mockTokenData.logoUrl || "/placeholder.svg"}
              alt={`${mockTokenData.name} logo`}
              width={48}
              height={48}
              className="rounded-full relative z-10"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">
              {mockTokenData.name}
            </h1>
            <p className="text-text-muted font-mono text-xs truncate">
              {truncatedAddress}
            </p>
          </div>
        </div>

        {/* Shield Score - Centered */}
        <div className="flex justify-center mb-5">
          <ShieldScore score={mockTokenData.score} grade={mockTokenData.grade} size="md" />
        </div>

        {/* Status Grid - 2 columns on mobile */}
        <div className="grid grid-cols-2 gap-2 mb-4">
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
        <div className="bg-bg-card backdrop-blur-sm rounded-xl px-3 py-2.5 mb-4 border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-text-primary text-sm">
              {t.scan.liquidityRoute}:{" "}
              <span className="font-medium text-cyan-400">{t.scan.stable}</span>
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
      </main>

      {/* Fixed Bottom Actions */}
      <div className="sticky bottom-0 bg-bg-page/95 backdrop-blur-md border-t border-border-subtle px-4 py-4 space-y-2">
        <button
          type="button"
          onClick={handleSimulate}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
        >
          {t.scan.connectWallet}
        </button>

        <button
          type="button"
          onClick={() => setViewState("loading")}
          className="w-full py-3 rounded-xl font-medium text-text-secondary bg-bg-card hover:bg-bg-card-hover transition-all border border-border-subtle"
        >
          {t.scan.shareReport}
        </button>

        <p className="text-center text-text-muted text-xs pt-1">
          {t.scan.dataDisclaimer}
        </p>
      </div>
    </div>
  );
}

export const unstable_getServerSession = async () => {
  return null;
};
