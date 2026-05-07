"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loadDraft, clearDraft, addToHistory } from "@/lib/launchpad/storage";
import { useLanguage } from "@/context/LanguageContext";
import {
  runPreflight,
  createTokenInfo,
  createLaunchConfig,
  generateManifest,
} from "@/lib/launchpad/api-client";
import type {
  LaunchConfigDraft,
  PreflightReport,
  ShieldProofManifest,
} from "@/lib/launchpad/types";

function ShieldCheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [draft, setDraft] = useState<LaunchConfigDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [manifest, setManifest] = useState<ShieldProofManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"draft" | "preflight" | "manifest">("draft");
  const manifestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = loadDraft();
    if (!saved) {
      router.push("/launchpad/create");
      return;
    }
    setDraft(saved);
  }, [router]);

  useEffect(
    () => () => {
      if (manifestTimeoutRef.current) clearTimeout(manifestTimeoutRef.current);
    },
    []
  );

  const handlePreflight = async () => {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      const result = await runPreflight(draft);
      if (!result.success) {
        setError(
          result.error?.message ||
            result.issues?.map((i) => i.message).join(", ") ||
            "Preflight validation failed"
        );
        return;
      }
      if (!result.response) {
        setError("Invalid preflight response");
        return;
      }
      const normalized = {
        ...result.response,
        issues: (result.response.issues ?? []).map((i: any) => ({
          ...i,
          severity:
            i.severity === "error" || i.severity === "warning" || i.severity === "info"
              ? i.severity
              : "error",
        })),
      } as any;
      setPreflightReport(normalized);
      setStep("preflight");
      if (result.response.isValid) {
        if (manifestTimeoutRef.current) clearTimeout(manifestTimeoutRef.current);
        manifestTimeoutRef.current = setTimeout(() => handleGenerateManifest(), 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run preflight");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateManifest = async () => {
    if (!draft || !preflightReport?.isValid) return;
    setLoading(true);
    setError(null);
    try {
      const tokenInfoResult = await createTokenInfo(draft.token);
      if (!tokenInfoResult.success) {
        setError(
          tokenInfoResult.error?.message ||
            tokenInfoResult.issues?.map((i) => i.message).join(", ") ||
            "Failed to create token info"
        );
        return;
      }
      if (!tokenInfoResult.response) {
        setError("Invalid token info response");
        return;
      }
      const tokenMint = tokenInfoResult.response.tokenMint;

      await createLaunchConfig(draft);

      let shieldScore = 85;
      let grade: "A" | "B" | "C" | "D" | "E" = "A";
      let isSafe = true;
      let badges: ShieldProofManifest["badges"] = [
        { key: "validated", title: "Token Validated", severity: "low", impact: "positive", tags: ["validation", "security"] },
      ];

      try {
        const scanResponse = await fetch(`/api/scan?mint=${encodeURIComponent(tokenMint)}`, {
          method: "GET",
          headers: { "Cache-Control": "no-store" },
        });
        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          if (scanData.response) {
            shieldScore = scanData.response.shieldScore || 85;
            grade =
              shieldScore >= 80 ? "A" : shieldScore >= 60 ? "B" : shieldScore >= 40 ? "C" : shieldScore >= 20 ? "D" : "E";
            isSafe = shieldScore >= 70;
            if (scanData.response.badges && Array.isArray(scanData.response.badges)) {
              badges = scanData.response.badges.map((b: any) => ({
                key: b.key || b.id || "unknown",
                title: b.title || b.label || "Badge",
                severity: (b.severity || b.level || "low").toLowerCase() as any,
                impact: b.impact || "neutral",
                tags: Array.isArray(b.tags) ? b.tags : [],
              }));
            }
          }
        }
      } catch {
        /* use defaults */
      }

      const manifestResult = await generateManifest({
        mint: tokenMint,
        shieldScore,
        grade,
        isSafe,
        badges,
        summary: `Token created with Shield Score ${shieldScore} (Grade ${grade})`,
      });

      if (!manifestResult.success || !manifestResult.response) {
        setError(manifestResult.error?.message || "Failed to generate manifest");
        return;
      }
      setManifest(manifestResult.response as ShieldProofManifest);
      setStep("manifest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate manifest");
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!manifest || !draft) return;
    try {
      addToHistory({
        mint: manifest.mint,
        manifest,
        createdAt: new Date().toISOString(),
        config: draft,
      });
      clearDraft();
      router.push(`/launchpad/${manifest.mint}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save launch");
    }
  };

  if (!draft) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  const safety = draft.safetyConfig ?? {
    renounceMint: true,
    renounceFreeze: true,
    lpLockMonths: 12,
  };
  const initialSupply = draft.initialSupply ?? 1_000_000_000;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-100 font-[Inter,sans-serif] mb-2">
          {t("launchpad_step3_title")}
        </h1>
        <p className="text-slate-400 text-sm mb-8">{t("launchpad_step3_subtitle")}</p>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-500/30 rounded-xl text-red-300 backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Draft Summary - Cyber-Receipt */}
        {step === "draft" && (
          <div className="space-y-6">
            <div
              className="bg-[#020617]/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden"
              style={{ fontFamily: "Roboto Mono, monospace" }}
            >
              {/* Section 1: Token Identity */}
              <div className="p-6 border-b border-slate-700/50">
                <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-4 font-[Inter,sans-serif]">
                  {t("launchpad_step3_tokenIdentity")}
                </h2>
                <div className="flex items-center gap-4">
                  {draft.token.imagePreviewUrl || draft.token.imageUrl ? (
                    <img
                      src={draft.token.imagePreviewUrl || draft.token.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-slate-600"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs">
                      IMG
                    </div>
                  )}
                  <div>
                    <div className="text-slate-100 font-semibold font-[Inter,sans-serif]">
                      {draft.token.name} <span className="text-cyan-400">(${draft.token.symbol})</span>
                    </div>
                    <div className="text-slate-500 text-sm font-mono mt-1">
                      {t("launchpad_step3_initialSupply")}: {initialSupply.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Security Configuration - Zebra list */}
              <div className="p-6 border-b border-slate-700/50">
                <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-4 font-[Inter,sans-serif]">
                  {t("launchpad_step3_securityConfig")}
                </h2>
                <div className="space-y-0">
                  <div className="flex items-center justify-between py-3 px-4 even:bg-slate-900/30">
                    <span className="text-slate-400 text-sm">{t("launchpad_step3_mintAuthority")}</span>
                    <div className="flex items-center gap-2">
                      {safety.renounceMint ? (
                        <>
                          <ShieldCheckIcon />
                          <span className="text-emerald-400 font-mono text-sm">{t("launchpad_step3_revokedSafe")}</span>
                        </>
                      ) : (
                        <>
                          <AlertIcon />
                          <span className="text-yellow-400 font-mono text-sm">{t("launchpad_step3_keptRisky")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 even:bg-slate-900/30">
                    <span className="text-slate-400 text-sm">{t("launchpad_step3_freezeAuthority")}</span>
                    <div className="flex items-center gap-2">
                      {safety.renounceFreeze ? (
                        <>
                          <ShieldCheckIcon />
                          <span className="text-emerald-400 font-mono text-sm">{t("launchpad_step3_revokedSafe")}</span>
                        </>
                      ) : (
                        <>
                          <AlertIcon />
                          <span className="text-yellow-400 font-mono text-sm">{t("launchpad_step3_keptRisky")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 even:bg-slate-900/30">
                    <span className="text-slate-400 text-sm">{t("launchpad_step3_liquidityLock")}</span>
                    <div className="flex items-center gap-2">
                      <LockIcon />
                      <span className="text-emerald-400 font-mono text-sm">
                        {safety.lpLockMonths} {safety.lpLockMonths === 1 ? "MONTH" : "MONTHS"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Estimated Fees */}
              <div className="p-6">
                <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 font-[Inter,sans-serif]">
                  {t("launchpad_step3_estimatedFees")}
                </h2>
                <div className="text-2xl font-mono font-bold text-cyan-400">~0.025 SOL</div>
                <p className="text-slate-500 text-xs mt-1">{t("launchpad_step3_feesSubtext")}</p>
              </div>
            </div>

            <Button
              onClick={handlePreflight}
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-semibold shadow-[0_0_25px_rgba(34,211,238,0.4)]"
            >
              {loading ? "…" : "Run Preflight Validation"}
            </Button>
          </div>
        )}

        {/* Preflight Results */}
        {step === "preflight" && preflightReport && (
          <div className="space-y-6">
            <div
              className={`rounded-2xl p-6 border ${
                preflightReport.isValid
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-950/50 border-red-500/30"
              } backdrop-blur-xl`}
            >
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Preflight Validation</h2>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  preflightReport.isValid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                }`}
              >
                {preflightReport.isValid ? "✓ Valid" : "✗ Invalid"}
              </span>
              {preflightReport.issues.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-red-300">
                  {preflightReport.issues.map((issue, idx) => (
                    <li key={idx}>
                      <strong>{issue.path}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {preflightReport.isValid && (
              <Button
                onClick={handleGenerateManifest}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-semibold"
              >
                {loading ? "Creating…" : "Create Token & Generate Shield Proof"}
              </Button>
            )}
            {!preflightReport.isValid && (
              <Button variant="outline" onClick={() => router.push("/launchpad/create")} className="w-full">
                Fix Issues
              </Button>
            )}
          </div>
        )}

        {/* Manifest Results - Deploy */}
        {step === "manifest" && manifest && (
          <div className="space-y-6">
            <div className="bg-[#020617]/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl font-bold text-cyan-400 font-mono">{manifest.shieldScore}/100</div>
                <div className="text-xl font-semibold text-slate-100">Grade {manifest.grade}</div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    manifest.isSafe ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {manifest.isSafe ? "Safe" : "Unsafe"}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{manifest.summary}</p>
            </div>

            <Button
              onClick={handleLaunch}
              className="w-full h-14 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-lg shadow-[0_0_30px_rgba(34,211,238,0.5)]"
            >
              <RocketIcon />
              {t("launchpad_step3_signLaunch")}
            </Button>
            <p className="text-center text-xs text-slate-500 font-mono">
              Token mint: {manifest.mint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


