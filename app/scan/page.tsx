"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Home, AlertCircle, Loader2 } from "lucide-react";
import { ShieldScore } from "@/components/bags-shield/shield-score";
import {
  StatusBadge,
  type BadgeStatus,
} from "@/components/bags-shield/status-badge";
import { ShareSheet, type ShareData } from "@/components/bags-shield/share-sheet";
import { InlineScanInput } from "@/components/bags-shield/quick-scan-modal";
import { TradeModal } from "@/components/bags-shield/trade-modal";
import { useLanguage } from "@/lib/i18n/language-context";
import { backendClient, type ScanResult } from "@/lib/backend-client";
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
  const [showTradeModal, setShowTradeModal] = useState(false);

  // Use refs to track in-flight requests and prevent duplicates
  const inFlightRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch scan data on mount or when mint changes (with dedup protection)
  useEffect(() => {
    if (!mint) {
      setViewState("idle");
      return;
    }

    // Skip if same mint is already in-flight
    if (inFlightRef.current === mint) {
      return;
    }

    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Mark this request as in-flight
    inFlightRef.current = mint;
    abortControllerRef.current = new AbortController();

    const fetchScan = async () => {
      setViewState("loading");
      setError("");

      try {
        const result = await backendClient.scan(mint);
        // Only update state if this is still the current mint (not stale request)
        if (inFlightRef.current === mint) {
          setScanData(result);
          setViewState("success");
        }
      } catch (err: any) {
        // Only update state if this is still the current mint
        if (inFlightRef.current === mint) {
          const errorMsg = err?.message || "Scan failed";
          // Check for rate limit error
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError("Rate limited. Please wait before trying again.");
          } else {
            setError(errorMsg);
          }
          setViewState("error");
        }
      } finally {
        // Clear in-flight marker if still current
        if (inFlightRef.current === mint) {
          inFlightRef.current = null;
        }
      }
    };

    fetchScan();

    // Cleanup: abort request on unmount or mint change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mint]);

  const handleRetry = () => {
    if (mint) {
      // Force a new fetch by clearing the in-flight marker
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

  const handleNewScan = () => {
    router.push("/");
  };

  const shareData: ShareData = scanData
    ? {
        title: "Bags Shield Security Report",
        text: `${scanData.name} (${scanData.symbol}) - ShieldScore: ${scanData.score}/100 (Grade ${scanData.grade}) - Security analysis by Bags Shield`,
        url: typeof window !== "undefined" ? window.location.href : "",
      }
    : {
        title: "Bags Shield",
        text: "Security analysis by Bags Shield",
        url: typeof window !== "undefined" ? window.location.href : "",
      };

  const truncatedAddress = mint
    ? `${mint.slice(0, 5)}...${mint.slice(-4)}`
    : "";

  // Handle scan from inline input
  const handleInlineScan = (newMint: string) => {
    router.push(`/scan?mint=${encodeURIComponent(newMint)}`);
  };

  // Idle state - no mint provided, show inline input
  if (viewState === "idle") {
    return <InlineScanInput onScan={handleInlineScan} />;
  }

  // Loading state
  if (viewState === "loading") {
    return (
      <div className="min-h-screen bg-bg-page flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-[var(--cyan-primary)] animate-spin" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Scanning Token...
          </h2>
          <p className="text-sm text-text-muted">
            Analyzing security and checking for risks
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === "error") {
    return (
      <div className="min-h-screen bg-bg-page flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Scan Failed
          </h2>
          <p className="text-sm text-text-muted mb-6">
            {error || "Unable to complete scan. Please try again."}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white hover:opacity-90 transition-all shadow-[0_0_16px_var(--cyan-glow)]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={handleNewScan}
              className="w-full py-3 rounded-xl font-medium text-text-secondary bg-bg-card hover:bg-bg-card-hover transition-all border border-border-subtle"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state - show scan results
  if (viewState === "success" && scanData) {
    const statusMap: Record<ScanResult["status"], BadgeStatus> = {
      safe: "safe",
      warning: "warning",
      danger: "danger",
    };

    return (
      <div className="min-h-screen bg-bg-page pb-6">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-page/95 backdrop-blur-lg border-b border-border-subtle px-4 py-3">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center border border-[var(--cyan-primary)]/30">
                <svg className="w-4 h-4 text-[var(--cyan-primary)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-text-primary">Scan Result</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-9 h-9 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNewScan}
                className="w-9 h-9 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-[var(--cyan-primary)] transition-all"
              >
                <Home className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 pt-6">
          {/* Token Header */}
          <div className="bg-bg-card rounded-xl p-4 mb-4 border border-border-subtle">
            <div className="flex items-center gap-3 mb-3">
              {scanData.logoUrl && (
                <Image
                  src={scanData.logoUrl || "/placeholder.svg"}
                  alt={scanData.name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-text-primary">{scanData.name}</h1>
                <p className="text-sm text-text-muted font-mono truncate">
                  {truncatedAddress}
                </p>
              </div>
              <StatusBadge status={statusMap[scanData.status]} />
            </div>
          </div>

          {/* Shield Score */}
          <div className="mb-4">
            <ShieldScore score={scanData.score} grade={scanData.grade} />
          </div>

          {/* Trade Button */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowTradeModal(true)}
              className="w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-[var(--cyan-primary)] shadow-[0_0_16px_var(--cyan-glow)] hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Trade / Buy
            </button>
          </div>

          {/* Findings */}
          {scanData.findings && scanData.findings.length > 0 && (
            <div className="bg-bg-card rounded-xl p-4 border border-border-subtle mb-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Security Findings ({scanData.findings.length})
              </h3>
              <div className="space-y-2">
                {scanData.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3 bg-bg-card-hover rounded-lg border border-border-subtle"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          finding.severity === "critical" || finding.severity === "high"
                            ? "bg-red-400"
                            : finding.severity === "medium"
                            ? "bg-yellow-400"
                            : "bg-blue-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary mb-1">
                          {finding.title}
                        </p>
                        <p className="text-xs text-text-muted">{finding.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowShareSheet(true)}
              className="w-full py-3 rounded-xl font-medium text-text-secondary bg-bg-card hover:bg-bg-card-hover transition-all border border-border-subtle"
            >
              {t.scan.shareReport}
            </button>
          </div>

          {/* Share Sheet */}
          <ShareSheet
            isOpen={showShareSheet}
            onClose={() => setShowShareSheet(false)}
            shareData={shareData}
          />

          {/* Trade Modal */}
          {scanData && (
            <TradeModal
              isOpen={showTradeModal}
              onClose={() => setShowTradeModal(false)}
              tokenData={{
                mint: mint || "",
                name: scanData.name,
                symbol: scanData.symbol,
                logoUrl: scanData.logoUrl,
                score: scanData.score,
                grade: scanData.grade,
              }}
            />
          )}
        </div>
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
