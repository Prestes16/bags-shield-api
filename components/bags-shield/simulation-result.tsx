"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Home,
  CheckCircle,
  AlertTriangle,
  XOctagon,
  Shield,
  Zap,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Share2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { ShareSheet, type ShareData } from "@/components/bags-shield/share-sheet";
import { useState } from "react";

// Types
export type SimulationStatus = "approved" | "warning" | "failed";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface SecurityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface SimulationData {
  status: SimulationStatus;
  riskLevel: RiskLevel;
  input: {
    amount: number;
    token: string;
  };
  output: {
    amount: number;
    token: string;
  };
  priceImpact: number;
  networkFee: number;
  securityChecks: SecurityCheck[];
  errorMessage?: string;
  reason?: string; // Short reason line from backend (e.g., "High transfer tax detected")
}

interface SimulationResultProps {
  data?: SimulationData | null;
  isLoading?: boolean;
  error?: string | null;
  onProceed?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
}

// Hold To Confirm Button Component
function HoldToConfirmButton({ 
  onConfirm, 
  label,
  danger = false 
}: { 
  onConfirm: () => void; 
  label: string;
  danger?: boolean;
}) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimeoutRef = useState<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useState<NodeJS.Timeout | null>(null);

  const handlePointerDown = () => {
    setIsHolding(true);
    setProgress(0);

    // Progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);
    progressIntervalRef[0] = interval;

    // Confirm after hold duration
    const timeout = setTimeout(() => {
      onConfirm();
      setIsHolding(false);
      setProgress(0);
    }, 1500);
    holdTimeoutRef[0] = timeout;
  };

  const handlePointerUp = () => {
    setIsHolding(false);
    setProgress(0);
    if (holdTimeoutRef[0]) clearTimeout(holdTimeoutRef[0]);
    if (progressIntervalRef[0]) clearInterval(progressIntervalRef[0]);
  };

  const bgClass = danger 
    ? "bg-gradient-to-r from-red-500 to-orange-500"
    : "bg-gradient-to-r from-amber-500 to-orange-500";

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`relative w-full h-14 rounded-xl font-semibold text-white overflow-hidden transition-all ${bgClass} hover:shadow-lg`}
    >
      {/* Progress bar */}
      <div 
        className="absolute inset-0 bg-white/20 transition-all duration-75"
        style={{ transform: `translateX(${progress - 100}%)` }}
      />
      
      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isHolding ? "Hold..." : label}
        {!isHolding && <ChevronRight className="w-5 h-5" />}
      </span>
    </button>
  );
}

// Skeleton Loading
function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white/5 rounded-2xl border border-white/10 animate-pulse ${className}`}>
      <div className="p-5 space-y-4">
        <div className="h-5 w-32 bg-white/10 rounded" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-white/10 rounded" />
          <div className="h-4 w-3/4 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <header className="px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
        <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
      </header>
      <main className="flex-1 px-4 pb-24 space-y-4">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 animate-pulse">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white/10 mb-4" />
            <div className="h-7 w-48 bg-white/10 rounded mb-2" />
            <div className="h-5 w-32 bg-white/10 rounded" />
          </div>
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </main>
    </div>
  );
}

// Error State
function ErrorState({ 
  message, 
  onRetry, 
  onBack, 
  t 
}: { 
  message: string; 
  onRetry?: () => void; 
  onBack?: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <header className="px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack || (() => router.back())}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{t.simResult.title}</h1>
      </header>
      
      <main className="flex-1 px-4 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t.simResult.errorTitle}</h2>
        <p className="text-slate-400 text-sm mb-2">{t.simResult.errorDesc}</p>
        <p className="text-red-400/80 text-xs font-mono mb-8 max-w-xs">{message}</p>
        
        <div className="flex gap-3 w-full max-w-xs">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 py-3 rounded-xl bg-[var(--cyan-primary)]/20 text-[var(--cyan-primary)] font-medium hover:bg-[var(--cyan-primary)]/30 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t.simResult.tryAgain}
            </button>
          )}
          <button
            type="button"
            onClick={onBack || (() => router.push("/"))}
            className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-medium hover:bg-white/10 transition-all"
          >
            {t.simResult.backToHome}
          </button>
        </div>
      </main>
    </div>
  );
}

// Empty State
function EmptyState({ 
  onBack, 
  t 
}: { 
  onBack?: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <header className="px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack || (() => router.back())}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{t.simResult.title}</h1>
      </header>
      
      <main className="flex-1 px-4 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-slate-500/20 flex items-center justify-center mb-6">
          <Zap className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t.simResult.noData}</h2>
        <p className="text-slate-400 text-sm mb-8">{t.simResult.noDataDesc}</p>
        
        <button
          type="button"
          onClick={onBack || (() => router.push("/simulate"))}
          className="py-3 px-6 rounded-xl bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white font-medium hover:opacity-90 transition-all shadow-[0_0_16px_var(--cyan-glow)]"
        >
          {t.simulator.title}
        </button>
      </main>
    </div>
  );
}

// Status Configuration
const statusConfig = {
  approved: {
    icon: CheckCircle,
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
    shadowColor: "shadow-emerald-500/20",
    iconColor: "text-emerald-400",
    textColor: "text-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/30",
    shadowColor: "shadow-amber-500/20",
    iconColor: "text-amber-400",
    textColor: "text-amber-400",
  },
  failed: {
    icon: XOctagon,
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    shadowColor: "shadow-red-500/20",
    iconColor: "text-red-400",
    textColor: "text-red-400",
  },
};

const riskConfig = {
  low: { color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  critical: { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
};

export function SimulationResult({
  data,
  isLoading = false,
  error = null,
  onProceed,
  onRetry,
  onBack,
}: SimulationResultProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [showShareSheet, setShowShareSheet] = useState(false);

  const getStatusTitle = () => {
    switch (data?.status) {
      case "approved": return t.simResult.approved;
      case "warning": return t.simResult.warning;
      case "failed": return t.simResult.failed;
    }
  };

  const getStatusDesc = () => {
    switch (data?.status) {
      case "approved": return t.simResult.approvedDesc;
      case "warning": return t.simResult.warningDesc;
      case "failed": return t.simResult.failedDesc;
    }
  };

  const getRiskLabel = () => {
    switch (data?.riskLevel) {
      case "low": return t.simResult.low;
      case "medium": return t.simResult.medium;
      case "high": return t.simResult.high;
      case "critical": return t.simResult.critical;
    }
  };

  const handleProceed = () => {
    if (onProceed) {
      onProceed();
    } else {
      router.push("/confirm");
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/");
    }
  };

  const getPriceImpactColor = () => {
    if (data?.priceImpact < 1) return "text-emerald-400";
    if (data?.priceImpact < 3) return "text-amber-400";
    return "text-red-400";
  };

  const config = data ? statusConfig[data.status] : { icon: XOctagon, bgColor: "bg-red-500/20", borderColor: "border-red-500/30", shadowColor: "shadow-red-500/20", iconColor: "text-red-400", textColor: "text-red-400" };
  const StatusIcon = config.icon;
  const risk = data ? riskConfig[data.riskLevel] : { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" };

  const shareData: ShareData = {
    title: "Bags Shield Simulation Result",
    text: `Simulation Result: ${getStatusTitle()} (${getRiskLabel()}) - ${data?.input.amount} ${data?.input.token} → ${data?.output.amount.toLocaleString()} ${data?.output.token}`,
    url: typeof window !== "undefined" ? window.location.href : "",
  };

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} onBack={onBack} t={t} />;
  }

  // Empty state
  if (!data) {
    return <EmptyState onBack={onBack} t={t} />;
  }

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">{t.simResult.title}</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-10 h-10 rounded-xl bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-[var(--cyan-primary)] hover:bg-bg-card-hover transition-all"
        >
          <Home className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-4 pb-28 space-y-4 max-w-lg mx-auto w-full">
        {/* Status Hero Card */}
        <div className={`rounded-2xl border p-6 ${config.bgColor} ${config.borderColor} shadow-lg ${config.shadowColor}`}>
          <div className="flex flex-col items-center text-center">
            {/* Status Icon */}
            <div className={`w-18 h-18 rounded-full flex items-center justify-center mb-4 ${config.bgColor}`}>
              <StatusIcon className={`w-12 h-12 ${config.iconColor}`} />
            </div>

            {/* Status Title */}
            <h2 className={`text-2xl font-bold mb-2 ${config.textColor}`}>
              {getStatusTitle()}
            </h2>
            
            {/* Reason Line (if provided by backend) */}
            {data.reason && (
              <p className="text-slate-200 text-sm font-medium mb-2 max-w-xs">
                {data.reason}
              </p>
            )}

            {/* Status Description (fallback if no reason) */}
            {!data.reason && (
              <p className="text-slate-300 text-sm mb-2 max-w-xs">
                {getStatusDesc()}
              </p>
            )}

            <div className="h-2" />

            {/* Risk Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${risk.bg} ${risk.border} ${risk.color}`}>
              <Shield className="w-4 h-4" />
              {getRiskLabel()}
            </div>

            {/* Error Message (only for failed) */}
            {data.status === "failed" && data.errorMessage && (
              <p className="text-red-300/80 text-sm mt-4 leading-relaxed max-w-xs">
                {data.errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle p-5">
          <h3 className="text-text-primary font-semibold mb-4 flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-[var(--cyan-primary)]" />
            {t.simResult.financialSummary}
          </h3>

          <div className="space-y-4">
            {/* Input → Output Flow */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">{t.simResult.input}</span>
                <p className="text-text-primary font-bold text-lg">
                  {data.input.amount} {data.input.token}
                </p>
              </div>

              <ArrowRight className="w-5 h-5 text-[var(--cyan-primary)] flex-shrink-0" />

              <div className="flex-1 space-y-1.5">
                <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">{t.simResult.estimatedOutput}</span>
                <p className={`font-bold text-lg ${data.status === "failed" ? "text-text-muted" : "text-emerald-400"}`}>
                  {data.status === "failed" 
                    ? "N/A" 
                    : `~${data.output.amount.toLocaleString()} ${data.output.token}`
                  }
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border-subtle" />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Price Impact */}
              <div className="space-y-1.5">
                <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">{t.simResult.priceImpact}</span>
                <p className={`font-bold text-base ${getPriceImpactColor()}`}>
                  {data.priceImpact < 0.01 ? "< 0.01" : data.priceImpact.toFixed(2)}%
                </p>
              </div>

              {/* Network Fee */}
              <div className="space-y-1.5">
                <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">{t.simResult.networkFee}</span>
                <p className="text-text-secondary font-semibold text-base">
                  {data.networkFee} SOL
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Checks Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-[var(--cyan-primary)]" />
            {t.simResult.securityChecks}
          </h3>

          <div className="space-y-2">
            {data.securityChecks.map((check) => (
              <div
                key={check.id}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  check.passed ? "bg-emerald-500/10" : "bg-red-500/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    check.passed ? "bg-emerald-500/20" : "bg-red-500/20"
                  }`}>
                    {check.passed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    check.passed ? "text-slate-200" : "text-red-200"
                  }`}>
                    {check.label}
                  </span>
                </div>
                {check.detail && (
                  <span className="text-xs text-slate-400">{check.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bg-page via-bg-page to-transparent border-t border-border-subtle/50">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Primary Action - Approved: Normal button */}
          {data.status === "approved" && (
            <button
              type="button"
              onClick={handleProceed}
              className="w-full h-14 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-[var(--cyan-primary)] hover:opacity-90 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              {t.simResult.proceedToSign}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}

          {/* Primary Action - Warning: Hold to confirm */}
          {data.status === "warning" && (
            <HoldToConfirmButton
              onConfirm={handleProceed}
              label={t.simResult.proceedAnyway}
              danger={false}
            />
          )}

          {/* Primary Action - Failed: Hold to confirm (if retryable) or disabled */}
          {data.status === "failed" && (
            <>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full h-14 rounded-xl font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {t.simResult.tryAgain}
                </button>
              ) : (
                <div className="w-full h-14 rounded-xl font-semibold text-slate-500 bg-slate-800/50 border border-slate-700 flex items-center justify-center gap-2 cursor-not-allowed">
                  <XOctagon className="w-5 h-5" />
                  {t.simResult.cannotProceed || "Cannot proceed"}
                </div>
              )}
            </>
          )}

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShowShareSheet(true)}
              className="h-12 rounded-xl font-medium text-text-secondary bg-bg-card hover:bg-bg-card-hover border border-border-subtle transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              {t.common.share}
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="h-12 rounded-xl font-medium text-text-primary bg-bg-card hover:bg-bg-card-hover border border-border-subtle transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              {t.home.backToHome}
            </button>
          </div>
        </div>
      </div>

      {/* Share Sheet */}
      <ShareSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        shareData={shareData}
      />
    </div>
  );
}
