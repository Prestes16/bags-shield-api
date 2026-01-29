"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Home, AlertCircle, Loader2, Lock, Shield, Share2, Lock as LockIcon } from "lucide-react";
import { backendClient, type ScanResult } from "@/lib/backend-client";
import { InlineScanInput } from "@/components/bags-shield/quick-scan-modal";
import { ShareSheet, type ShareData } from "@/components/bags-shield/share-sheet";
import Loading from "./loading";

type ViewState = "idle" | "loading" | "success" | "error";

const ScanResultPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mint = searchParams.get("mint") || searchParams.get("address");

  const [viewState, setViewState] = useState<ViewState>("idle");
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string>("");
  const [showShareSheet, setShowShareSheet] = useState(false);

  // Swap form state
  const [amount, setAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
          const errorMsg = err?.message || "Falha no scan";
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError("Limite de requisições atingido. Aguarde antes de tentar novamente.");
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
          const errorMsg = err?.message || "Falha no scan";
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError("Limite atingido. Aguarde.");
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

  // NATIVE SWAP HANDLER - EXACT INTEGRATION LOGIC
  const handleInternalSwap = async () => {
    if (!amount || !scanData) return;

    setIsSwapping(true);
    setErrorMessage("");

    try {
      // 1. Get Quote & Transaction from internal API (Monetized)
      // POST /api/swap with platformFeeBps: 50
      const response = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: "So11111111111111111111111111111111111111112", // SOL
          outputMint: scanData.tokenInfo.mint,
          amount: parseFloat(amount) * 1e9, // Convert to lamports
          isSafe: scanData.security.isSafe, // Safety Check
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro na troca");
      }

      const { swapTransaction } = await response.json();

      // 2. Request Wallet Signature (Placeholder for Wallet Adapter)
      if (swapTransaction) {
        console.log("[v0] Ready to sign transaction via Helius RPC");
        console.log("[v0] Transaction:", swapTransaction);
        // TODO: wallet.sendTransaction(swapTransaction...)
        
        // Mock success for now
        setErrorMessage("Transação preparada! (Conecte carteira para finalizar)");
      }
    } catch (error: any) {
      console.error("[v0] Swap failed", error);
      setErrorMessage(error.message || "Erro na troca. Tente novamente.");
    } finally {
      setIsSwapping(false);
    }
  };

  const shareData: ShareData = scanData
    ? {
        title: "Relatório de Segurança Bags Shield",
        text: `${scanData.tokenInfo.name} (${scanData.tokenInfo.symbol}) - Nível de Blindagem: ${scanData.security.score}/100 (Nota ${scanData.security.grade})`,
        url: typeof window !== "undefined" ? window.location.href : "",
      }
    : {
        title: "Bags Shield",
        text: "Análise de segurança por Bags Shield",
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
            Escaneando Token...
          </h2>
          <p className="text-sm text-slate-400">
            Analisando segurança e verificando riscos
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
            Falha no Scan
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {error || "Não foi possível completar o scan. Tente novamente."}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full min-h-[48px] rounded-xl font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all shadow-[0_0_16px_rgba(6,182,212,0.3)]"
            >
              Tentar Novamente
            </button>
            <button
              type="button"
              onClick={handleNewScan}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-400 bg-white/5 hover:bg-white/10 transition-all border border-white/10"
            >
              Voltar ao Início
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

    const isSwapLocked = security.score < 50;

    return (
      <div className="min-h-screen flex flex-col pb-24" style={{ background: "#020617" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl border-b px-4 py-3" style={{ background: "rgba(2,6,23,0.95)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-white">Relatório de Segurança</span>
            <button
              type="button"
              onClick={handleNewScan}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-all border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
            {/* Hero: Token Avatar + Score */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
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
                    width={100}
                    height={100}
                    className="relative rounded-full border-4"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  />
                ) : (
                  <div
                    className="relative w-[100px] h-[100px] rounded-full border-4 flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <Shield className="w-10 h-10 text-slate-400" />
                  </div>
                )}
              </div>

              <h1 className="text-xl font-bold text-white mb-1 text-center">
                {tokenInfo.name}
              </h1>
              <p className="text-sm text-slate-400 font-mono mb-4">
                ${tokenInfo.symbol}
              </p>

              {/* Compact Radial Gauge */}
              <div className="relative flex items-center justify-center mb-3">
                <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="408"
                    strokeDashoffset={408 - (security.score / 100) * 408}
                    style={{
                      filter: `drop-shadow(0 0 10px ${gradeGlow})`,
                      transition: "stroke-dashoffset 1.2s ease-out",
                    }}
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-400 tracking-wider mb-0.5">
                    Nível de Blindagem
                  </span>
                  <span className="text-4xl font-bold text-white">
                    {security.score}
                  </span>
                  <span className="text-sm text-slate-400 mt-0.5">
                    Nota {security.grade}
                  </span>
                </div>
              </div>

              {/* Verified Badge */}
              {integrity.isVerified && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium" style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#10b981" }}>
                  <Lock className="w-3.5 h-3.5" />
                  Verificado (Bags)
                </div>
              )}
            </div>

            {/* Security Warnings */}
            {(security.mintAuthority || security.freezeAuthority) && (
              <div className="mb-4 p-3 rounded-xl border" style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" }}>
                <h3 className="text-xs font-semibold text-amber-400 mb-2">
                  Avisos de Segurança
                </h3>
                <div className="space-y-1.5">
                  {security.mintAuthority && (
                    <div className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Autoridade de Mint Ativa - Supply pode ser inflado</span>
                    </div>
                  )}
                  {security.freezeAuthority && (
                    <div className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Autoridade de Congelamento - Contas podem ser congeladas</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Findings */}
            {findings.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-white mb-2">
                  Descobertas de Segurança ({findings.length})
                </h3>
                <div className="space-y-2">
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
                        className="backdrop-blur-sm p-3 rounded-lg border"
                        style={{
                          background: config.bg,
                          borderColor: config.border,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${config.dot} ${config.pulse ? "animate-pulse" : ""}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white mb-0.5">
                              {finding.label}
                            </p>
                            <p className="text-xs text-slate-400 leading-relaxed">
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

            {/* Share Button */}
            <button
              type="button"
              onClick={() => setShowShareSheet(true)}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 flex items-center justify-center gap-2 transition-all border hover:bg-white/5 mb-4"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <Share2 className="w-5 h-5" />
              Compartilhar Relatório
            </button>
          </div>
        </div>

        {/* Sticky Bottom: Native Swap Form */}
        <div className="fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl border-t px-4 py-4" style={{ background: "rgba(2,6,23,0.98)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="max-w-2xl mx-auto">
            {isSwapLocked ? (
              // Security Lock Overlay
              <div className="relative">
                <div className="blur-sm opacity-30 pointer-events-none">
                  <input
                    type="number"
                    placeholder="0.0"
                    disabled
                    className="w-full min-h-[48px] px-4 rounded-xl text-white font-medium border mb-2"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                  />
                  <button
                    disabled
                    className="w-full min-h-[52px] rounded-xl font-bold text-white"
                    style={{ background: "linear-gradient(to right, #10b981, #06b6d4)" }}
                  >
                    Trocar Agora
                  </button>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-xl rounded-2xl px-6 py-4 text-center">
                    <LockIcon className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-red-400 mb-1">
                      BLOQUEADO POR SEGURANÇA
                    </p>
                    <p className="text-xs text-slate-400">
                      Score abaixo de 50 - Token muito arriscado
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Active Swap Form
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Você Paga (SOL)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.01"
                  min="0"
                  className="w-full min-h-[48px] px-4 rounded-xl text-white text-lg font-medium border mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                />

                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Você Recebe ~ {tokenInfo.symbol}
                </label>

                {errorMessage && (
                  <div className="mb-3 p-2 rounded-lg border text-xs text-center" style={{ background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                    {errorMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInternalSwap}
                  disabled={!amount || parseFloat(amount) <= 0 || isSwapping}
                  className="w-full min-h-[52px] rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  style={{
                    background: "linear-gradient(to right, #10b981, #06b6d4)",
                  }}
                >
                  {isSwapping ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Trocar Agora"
                  )}
                </button>
              </div>
            )}
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
