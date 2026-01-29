"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Home, AlertCircle, Loader2, Lock, Shield, ExternalLink, Share2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { backendClient, type ScanResult } from "@/lib/backend-client";
import { InlineScanInput } from "@/components/bags-shield/quick-scan-modal";
import { ShareSheet, type ShareData } from "@/components/bags-shield/share-sheet";
import Loading from "./loading";

type ViewState = "idle" | "loading" | "success" | "error";

const ScanResultPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const mint = searchParams.get("mint") || searchParams.get("address");

  const [viewState, setViewState] = useState<ViewState>("idle");
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string>("");
  const [showShareSheet, setShowShareSheet] = useState(false);

  const inFlightRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mint) {
      setViewState("idle");
      return;
    }

    if (inFlightRef.current === mint) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    inFlightRef.current = mint;
    abortControllerRef.current = new AbortController();

    const fetchScan = async () => {
      setViewState("loading");
      setError("");

      try {
        const result = await backendClient.scan(mint);
        if (inFlightRef.current === mint) {
          setScanData(result);
          setViewState("success");
        }
      } catch (err: any) {
        if (inFlightRef.current === mint) {
          const errorMsg = err?.message || "Scan failed";
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError("Rate limited. Please wait before trying again.");
          } else {
            setError(errorMsg);
          }
          setViewState("error");
        }
      } finally {
        if (inFlightRef.current === mint) {
          inFlightRef.current = null;
        }
      }
    };

    fetchScan();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mint]);

  const handleRetry = () => {
    if (mint) {
      inFlightRef.current = null;
      setViewState("loading");
      setError("");

      const fetchScan = async () => {
        try {
          const result = await backendClient.scan(mint);
          if (inFlightRef.current === null) {
            setScanData(result);
            setViewState("success");
          }
        } catch (err: any) {
          const errorMsg = err?.message || "Scan failed";
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError("Rate limited. Please wait before trying again.");
          } else {
            setError(errorMsg);
          }
          setViewState("error");
        }
      };

      fetchScan();
    }
  };

  const handleNewScan = () => router.push("/");
  const handleInlineScan = (newMint: string) => {
    router.push(`/scan?mint=${encodeURIComponent(newMint)}`);
  };

  const handleJupiterSwap = () => {
    if (scanData && mint) {
      const jupiterUrl = `https://jup.ag/swap/${mint}`;
      window.open(jupiterUrl, "_blank");
    }
  };

  const shareData: ShareData = scanData
    ? {
        title: "Bags Shield Security Report",
        text: `${scanData.tokenInfo.name} (${scanData.tokenInfo.symbol}) - ShieldScore: ${scanData.security.score}/100 (Grade ${scanData.security.grade})`,
        url: typeof window !== "undefined" ? window.location.href : "",
      }
    : {
        title: "Bags Shield",
        text: "Security analysis by Bags Shield",
        url: typeof window !== "undefined" ? window.location.href : "",
      };

  if (viewState === "idle") {
    return <InlineScanInput onScan={handleInlineScan} />;
  }

  if (viewState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#020617" }}>
        <div className="w-full max-w-md text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-cyan-400 animate-spin" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Scanning Token...
          </h2>
          <p className="text-sm text-slate-400">
            Analyzing security and checking for risks
          </p>
        </div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#020617" }}>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Scan Failed
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {error || "Unable to complete scan. Please try again."}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all shadow-[0_0_16px_rgba(6,182,212,0.3)]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={handleNewScan}
              className="w-full py-3 rounded-xl font-medium text-slate-400 bg-white/5 hover:bg-white/10 transition-all border border-white/10"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === "success" && scanData) {
    const { tokenInfo, security, integrity, findings } = scanData;
    const gradeColor =
      security.grade === "A" || security.grade === "B"
        ? "from-emerald-500 to-green-400"
        : security.grade === "C"
        ? "from-yellow-500 to-amber-400"
        : "from-red-500 to-rose-400";

    const gradeGlow =
      security.grade === "A" || security.grade === "B"
        ? "rgba(16,185,129,0.4)"
        : security.grade === "C"
        ? "rgba(245,158,11,0.4)"
        : "rgba(239,68,68,0.4)";

    return (
      <div className="min-h-screen pb-20" style={{ background: "#020617" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl border-b px-4 py-3" style={{ background: "rgba(2,6,23,0.95)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-white">Security Report</span>
            <button
              type="button"
              onClick={handleNewScan}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-all border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 pt-8">
          {/* Hero Section: Token Avatar + Score */}
          <div className="flex flex-col items-center mb-8">
            {/* Token Image with Glow */}
            <div className="relative mb-6">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{
                  background: `radial-gradient(circle, ${gradeGlow}, transparent)`,
                }}
              />
              {tokenInfo.imageUrl ? (
                <Image
                  src={tokenInfo.imageUrl || "/placeholder.svg"}
                  alt={tokenInfo.name}
                  width={120}
                  height={120}
                  className="relative rounded-full border-4"
                  style={{ borderColor: "rgba(255,255,255,0.1)" }}
                />
              ) : (
                <div
                  className="relative w-[120px] h-[120px] rounded-full border-4 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                >
                  <Shield className="w-12 h-12 text-slate-400" />
                </div>
              )}
            </div>

            {/* Token Name & Symbol */}
            <h1 className="text-2xl font-bold text-white mb-1 text-center">
              {tokenInfo.name}
            </h1>
            <p className="text-sm text-slate-400 font-mono mb-6">
              ${tokenInfo.symbol}
            </p>

            {/* Large Radial Gauge */}
            <div className="relative flex items-center justify-center mb-4">
              <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                {/* Background arc */}
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="502"
                  strokeDashoffset="125"
                />
                {/* Progress arc */}
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="url(#scoreGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="502"
                  strokeDashoffset={125 + (1 - security.score / 100) * 377}
                  style={{
                    filter: `drop-shadow(0 0 12px ${gradeGlow})`,
                    transition: "stroke-dashoffset 1.5s ease-out",
                  }}
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center Score */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-slate-400 tracking-wider mb-1">
                  ShieldScore
                </span>
                <span className="text-5xl font-bold text-white">
                  {security.score}
                </span>
                <span className="text-lg text-slate-400 mt-1">
                  Grade {security.grade}
                </span>
              </div>
            </div>

            {/* Verified Badge */}
            {integrity.isVerified && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border" style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)" }}>
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  Verified by Bags
                </span>
              </div>
            )}
          </div>

          {/* Security Warnings */}
          {(security.mintAuthority || security.freezeAuthority) && (
            <div className="mb-6 p-4 rounded-xl border" style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" }}>
              <h3 className="text-sm font-semibold text-amber-400 mb-2">
                Security Warnings
              </h3>
              <div className="space-y-2">
                {security.mintAuthority && (
                  <div className="flex items-start gap-2 text-sm text-amber-300">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Mint Authority Active - Supply can be inflated</span>
                  </div>
                )}
                {security.freezeAuthority && (
                  <div className="flex items-start gap-2 text-sm text-amber-300">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Freeze Authority Active - Accounts can be frozen</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">
                Security Findings ({findings.length})
              </h3>
              <div className="space-y-3">
                {findings.map((finding, idx) => {
                  const severityConfig = {
                    HIGH: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", dot: "bg-red-400", pulse: true },
                    MEDIUM: { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.2)", dot: "bg-yellow-400", pulse: false },
                    LOW: { bg: "rgba(59,130,246,0.05)", border: "rgba(59,130,246,0.2)", dot: "bg-blue-400", pulse: false },
                  };
                  const config = severityConfig[finding.severity];

                  return (
                    <div
                      key={idx}
                      className="backdrop-blur-sm p-4 rounded-xl border"
                      style={{
                        background: config.bg,
                        borderColor: config.border,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot} ${config.pulse ? "animate-pulse" : ""}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white mb-1">
                            {finding.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {finding.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 mb-8">
            <button
              type="button"
              onClick={handleJupiterSwap}
              disabled={security.score < 50}
              className="w-full min-h-[48px] rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale"
              style={{
                background: security.score >= 50 ? "linear-gradient(to right, #10b981, #06b6d4)" : "rgba(100,100,100,0.3)",
                boxShadow: security.score >= 50 ? "0 0 20px rgba(16,185,129,0.4)" : "none",
              }}
            >
              <ExternalLink className="w-5 h-5" />
              {security.score >= 50 ? "Swap via Jupiter" : "Unsafe - Swap Disabled"}
            </button>

            <button
              type="button"
              onClick={() => setShowShareSheet(true)}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 flex items-center justify-center gap-2 transition-all border hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <Share2 className="w-5 h-5" />
              Share Report
            </button>
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

  return null;
};

export default function ScanPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ScanResultPage />
    </Suspense>
  );
}
