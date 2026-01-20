"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  Info,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type RiskSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface FindingData {
  id: string;
  title: string;
  severity: RiskSeverity;
  description: string;
  impact: string;
  rawData: Record<string, unknown>;
}

interface FindingDetailsProps {
  finding: FindingData;
  onBack: () => void;
  isLoading?: boolean;
}

function getSeverityConfig(severity: RiskSeverity) {
  switch (severity) {
    case "critical":
      return {
        icon: ShieldAlert,
        label: "CRITICAL",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/50",
        textColor: "text-red-400",
        badgeBg: "bg-red-500",
        glowColor: "shadow-[0_0_30px_rgba(239,68,68,0.3)]",
      };
    case "high":
      return {
        icon: ShieldAlert,
        label: "HIGH RISK",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/40",
        textColor: "text-red-400",
        badgeBg: "bg-red-500",
        glowColor: "shadow-[0_0_25px_rgba(239,68,68,0.2)]",
      };
    case "medium":
      return {
        icon: AlertTriangle,
        label: "MEDIUM",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/40",
        textColor: "text-amber-400",
        badgeBg: "bg-amber-500",
        glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
      };
    case "low":
      return {
        icon: AlertTriangle,
        label: "LOW",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/30",
        textColor: "text-yellow-400",
        badgeBg: "bg-yellow-500",
        glowColor: "",
      };
    case "info":
    default:
      return {
        icon: Info,
        label: "INFO",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        textColor: "text-blue-400",
        badgeBg: "bg-blue-500",
        glowColor: "",
      };
  }
}

function FindingDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
        </div>

        {/* Severity Hero Skeleton */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-white/10 animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-3/4 bg-white/10 rounded animate-pulse" />
              <div className="h-6 w-24 bg-white/10 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Educational Content Skeleton */}
        <div className="space-y-6">
          {/* What it means */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
              <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-white/10 rounded animate-pulse" />
            </div>
          </div>

          {/* Impact */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
              <div className="h-5 w-24 bg-white/10 rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
            </div>
          </div>

          {/* Code Block Skeleton */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
              <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FindingDetails({
  finding,
  onBack,
  isLoading = false,
}: FindingDetailsProps) {
  const [copied, setCopied] = useState(false);
  const config = getSeverityConfig(finding.severity);
  const IconComponent = config.icon;

  const handleCopyData = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(finding.rawData, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (isLoading) {
    return <FindingDetailsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-bg-page text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Navigation Header */}
        <header className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Detalhe do Risco</h1>
        </header>

        {/* Severity Hero Card */}
        <div
          className={`${config.bgColor} backdrop-blur-xl border ${config.borderColor} rounded-2xl p-6 mb-6 ${config.glowColor} transition-all`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-full ${config.bgColor} flex items-center justify-center`}
            >
              <IconComponent className={`w-7 h-7 ${config.textColor}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">
                {finding.title}
              </h2>
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold text-white ${config.badgeBg}`}
              >
                {config.label}
              </span>
            </div>
          </div>
        </div>

        {/* Educational Content */}
        <div className="space-y-4">
          {/* What it means */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-semibold text-white">
                O que isso significa?
              </h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {finding.description}
            </p>
          </div>

          {/* Impact */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">Impacto</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {finding.impact}
            </p>
          </div>

          {/* Raw Data (Nerd Mode) */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">
                  {"</>"}
                </span>
                <h3 className="text-sm font-semibold text-slate-400">
                  Dados Brutos
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyData}
                className={`h-8 px-3 text-xs font-medium rounded-lg transition-all active:scale-95 ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Data
                  </>
                )}
              </Button>
            </div>
            <pre className="text-xs font-mono text-slate-400 bg-black/30 rounded-lg p-4 overflow-x-auto">
              <code>{JSON.stringify(finding.rawData, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export { FindingDetailsSkeleton };
