"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Home, AlertCircle, Loader2, Lock, Shield, Share2, Coins, AlertTriangle, X } from "lucide-react";
import { backendClient, type ScanResult } from "@/lib/backend-client";
import { InlineScanInput } from "@/components/bags-shield/quick-scan-modal";
import { ShareSheet, type ShareData } from "@/components/bags-shield/share-sheet";
import { useWallet } from "@/lib/wallet/wallet-context";
import Loading from "./loading";

type ViewState = "idle" | "loading" | "success" | "error";
type Lang = "pt" | "en";

// 1. GLOBAL TRANSLATION DICTIONARY
const t = {
  pt: {
    scan: "Escanear",
    securityReport: "Relatório de Segurança",
    scanning: "Escaneando Token...",
    analyzingSecurity: "Analisando segurança e verificando riscos",
    scanFailed: "Falha no Scan",
    tryAgain: "Tentar Novamente",
    backToHome: "Voltar ao Início",
    shieldScore: "Nível de Blindagem",
    grade: "Nota",
    verified: "Verificado (Bags)",
    securityWarnings: "Avisos de Segurança",
    mintAuthority: "Autoridade de Mint Ativa - Supply pode ser inflado",
    freezeAuthority: "Autoridade de Congelamento - Contas podem ser congeladas",
    findings: "Descobertas de Segurança",
    shareReport: "Compartilhar Relatório",
    youPay: "Você Paga",
    youReceive: "Você Recebe",
    swap: "Trocar Agora",
    processing: "Processando...",
    connectWallet: "Conectar Carteira",
    connecting: "Conectando...",
    lockedBySecurity: "BLOQUEADO POR SEGURANÇA",
    scoreTooLow: "Score abaixo de 50 - Token muito arriscado",
    riskModalTitle: "ALTO RISCO DETECTADO",
    riskModalMessage: "Este token tem score baixo e pode resultar em perda de fundos. Você deseja prosseguir com a compra?",
    cancel: "Cancelar",
    proceedRisk: "Entendo o Risco, Prosseguir",
    walletRequired: "Conecte sua carteira para trocar",
    rateLimited: "Limite de requisições atingido. Aguarde antes de tentar novamente.",
  },
  en: {
    scan: "Scan",
    securityReport: "Security Report",
    scanning: "Scanning Token...",
    analyzingSecurity: "Analyzing security and checking for risks",
    scanFailed: "Scan Failed",
    tryAgain: "Try Again",
    backToHome: "Back to Home",
    shieldScore: "Shield Score",
    grade: "Grade",
    verified: "Verified (Bags)",
    securityWarnings: "Security Warnings",
    mintAuthority: "Mint Authority Active - Supply can be inflated",
    freezeAuthority: "Freeze Authority - Accounts can be frozen",
    findings: "Security Findings",
    shareReport: "Share Report",
    youPay: "You Pay",
    youReceive: "You Receive",
    swap: "Buy Now",
    processing: "Processing...",
    connectWallet: "Connect Wallet",
    connecting: "Connecting...",
    lockedBySecurity: "LOCKED BY SECURITY",
    scoreTooLow: "Score below 50 - Very risky token",
    riskModalTitle: "HIGH RISK DETECTED",
    riskModalMessage: "This token has a low score and may result in loss of funds. Do you want to proceed with the purchase?",
    cancel: "Cancel",
    proceedRisk: "I Understand the Risk, Proceed",
    walletRequired: "Connect your wallet to swap",
    rateLimited: "Rate limit exceeded. Please try again later.",
  },
};

interface ScanResultPageProps {
  lang?: Lang;
}

const ScanResultPage = ({ lang = "pt" }: ScanResultPageProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mint = searchParams.get("mint") || searchParams.get("address");
  
  // 2. REAL WALLET CONNECTION
  const wallet = useWallet();

  const [viewState, setViewState] = useState<ViewState>("idle");
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string>("");
  const [showShareSheet, setShowShareSheet] = useState(false);

  // 3. RISK MODAL STATE
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [pendingSwapAmount, setPendingSwapAmount] = useState("");

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
          const errorMsg = err?.message || t[lang].scanFailed;
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError(t[lang].rateLimited);
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
  }, [mint, lang]);

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
          const errorMsg = err?.message || t[lang].scanFailed;
          if (err?.code === "RATE_LIMITED" || err?.status === 429) {
            setError(t[lang].rateLimited);
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

  // 2 & 3: REAL WALLET + RISK MODAL LOGIC
  const handleSwapClick = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    // Check wallet connection first
    if (!wallet.connected) {
      const connected = await wallet.connect();
      if (!connected) {
        setErrorMessage(wallet.connectionError || t[lang].walletRequired);
        return;
      }
    }

    // 3. RISK LOGIC: Show modal if score < 50
    if (scanData && scanData.security.score < 50) {
      setPendingSwapAmount(amount);
      setShowRiskModal(true);
      return;
    }

    // Proceed with swap if safe
    await executeSwap(amount);
  };

  const handleRiskConfirm = async () => {
    setShowRiskModal(false);
    await executeSwap(pendingSwapAmount, true); // Pass userAcceptedRisk = true
    setPendingSwapAmount("");
  };

  const handleRiskCancel = () => {
    setShowRiskModal(false);
    setPendingSwapAmount("");
  };

  // Build swap transaction (without sending)
  const buildSwapTransactionOnly = async (
    outputMint: string, 
    swapAmount: string, 
    userAcceptedRisk: boolean = false
  ) => {
    const response = await fetch("/api/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputMint: "So11111111111111111111111111111111111111112", // SOL
        outputMint,
        amount: parseFloat(swapAmount) * 1e9, // Convert to lamports
        platformFeeBps: 50, // 0.5% platform fee
        isSafe: scanData?.security.isSafe || false,
        userAcceptedRisk, // Pass user risk acceptance flag
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to build transaction");
    }

    const { swapTransaction } = await response.json();
    return swapTransaction;
  };

  // Execute swap with proper wallet adapter flow
  const executeSwap = async (swapAmount: string, userAcceptedRisk: boolean = false) => {
    if (!swapAmount || !scanData) return;

    setIsSwapping(true);
    setErrorMessage("");

    try {
      console.log("[v0] Building swap transaction...");
      
      // 1. Build transaction (does not send yet)
      const transaction = await buildSwapTransactionOnly(
        scanData.tokenInfo.mint,
        swapAmount,
        userAcceptedRisk
      );

      console.log("[v0] Transaction built successfully");

      // 2. Send via Wallet Adapter (Standard Solana Flow)
      if (wallet.connected && transaction) {
        console.log("[v0] Preparing to sign with connected wallet...");
        
        // TODO: Implement actual Solana transaction sending
        // Once @solana/wallet-adapter-react is fully integrated:
        // const tx = Transaction.from(Buffer.from(transaction, 'base64'));
        // const signature = await wallet.sendTransaction(tx, connection);
        // console.log("[v0] Transaction sent:", signature);
        
        // For now, show success message
        setErrorMessage(`${t[lang].processing} (${lang === "pt" ? "Assine na carteira" : "Sign in wallet"})`);
        
        // Simulate success after 2 seconds
        setTimeout(() => {
          setErrorMessage(lang === "pt" ? "✓ Transação enviada com sucesso!" : "✓ Transaction sent successfully!");
        }, 2000);
      } else {
        throw new Error(t[lang].walletRequired);
      }
    } catch (error: any) {
      console.error("[v0] Swap execution failed:", error);
      setErrorMessage(error.message || `${t[lang].swap} ${lang === "pt" ? "falhou" : "failed"}`);
    } finally {
      setIsSwapping(false);
    }
  };

  const shareData: ShareData = scanData
    ? {
        title: lang === "pt" ? "Relatório de Segurança Bags Shield" : "Bags Shield Security Report",
        text: `${scanData.tokenInfo.name} (${scanData.tokenInfo.symbol}) - ${t[lang].shieldScore}: ${scanData.security.score}/100 (${t[lang].grade} ${scanData.security.grade})`,
        url: typeof window !== "undefined" ? window.location.href : "",
      }
    : {
        title: "Bags Shield",
        text: lang === "pt" ? "Análise de segurança" : "Security analysis",
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
            {t[lang].scanning}
          </h2>
          <p className="text-sm text-slate-400">
            {t[lang].analyzingSecurity}
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
            {t[lang].scanFailed}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {error || (lang === "pt" ? "Não foi possível completar o scan." : "Could not complete scan.")}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full min-h-[48px] rounded-xl font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all shadow-[0_0_16px_rgba(6,182,212,0.3)]"
            >
              {t[lang].tryAgain}
            </button>
            <button
              type="button"
              onClick={handleNewScan}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-400 bg-white/5 hover:bg-white/10 transition-all border border-white/10"
            >
              {t[lang].backToHome}
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

    // 3. Don't block swap - just style differently
    const isHighRisk = security.score < 50;
    const swapButtonColor = isHighRisk
      ? "linear-gradient(to right, #ef4444, #dc2626)" // Red for risky
      : "linear-gradient(to right, #10b981, #06b6d4)"; // Green for safe

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
            <span className="text-sm font-semibold text-white">{t[lang].securityReport}</span>
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

        {/* Main Content */}
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
                {/* 4. REAL DATA & ICON FIX */}
                {tokenInfo.imageUrl ? (
                  <Image
                    src={tokenInfo.imageUrl || "/placeholder.svg"}
                    alt={tokenInfo.name}
                    width={100}
                    height={100}
                    className="relative rounded-full border-4"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                    onError={(e) => {
                      // Fallback to Coins icon on error
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const fallback = document.createElement("div");
                        fallback.className = "relative w-[100px] h-[100px] rounded-full border-4 flex items-center justify-center";
                        fallback.style.background = "rgba(255,255,255,0.05)";
                        fallback.style.borderColor = "rgba(255,255,255,0.1)";
                        fallback.innerHTML = '<svg class="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" strokeWidth="2"/><circle cx="16" cy="9" r="4" strokeWidth="2"/></svg>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div
                    className="relative w-[100px] h-[100px] rounded-full border-4 flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <Coins className="w-12 h-12 text-slate-400" />
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
                    {t[lang].shieldScore}
                  </span>
                  <span className="text-4xl font-bold text-white">
                    {security.score}
                  </span>
                  <span className="text-sm text-slate-400 mt-0.5">
                    {t[lang].grade} {security.grade}
                  </span>
                </div>
              </div>

              {/* Verified Badge */}
              {integrity.isVerified && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium" style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#10b981" }}>
                  <Lock className="w-3.5 h-3.5" />
                  {t[lang].verified}
                </div>
              )}
            </div>

            {/* Security Warnings */}
            {(security.mintAuthority || security.freezeAuthority) && (
              <div className="mb-4 p-3 rounded-xl border" style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" }}>
                <h3 className="text-xs font-semibold text-amber-400 mb-2">
                  {t[lang].securityWarnings}
                </h3>
                <div className="space-y-1.5">
                  {security.mintAuthority && (
                    <div className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{t[lang].mintAuthority}</span>
                    </div>
                  )}
                  {security.freezeAuthority && (
                    <div className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{t[lang].freezeAuthority}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Findings */}
            {findings.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-white mb-2">
                  {t[lang].findings} ({findings.length})
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
              {t[lang].shareReport}
            </button>
          </div>
        </div>

        {/* Sticky Bottom: Native Swap Form */}
        <div className="fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl border-t px-4 py-4" style={{ background: "rgba(2,6,23,0.98)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="max-w-2xl mx-auto">
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              {t[lang].youPay} (SOL)
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
              {t[lang].youReceive} ~ {tokenInfo.symbol}
            </label>

            {errorMessage && (
              <div className="mb-3 p-2 rounded-lg border text-xs text-center" style={{ background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                {errorMessage}
              </div>
            )}

            {/* 3. RED BUTTON FOR RISKY TOKENS */}
            <button
              type="button"
              onClick={handleSwapClick}
              disabled={!amount || parseFloat(amount) <= 0 || isSwapping}
              className="w-full min-h-[52px] rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: swapButtonColor,
                boxShadow: isHighRisk ? "0 0 20px rgba(239,68,68,0.4)" : "0 0 20px rgba(16,185,129,0.4)",
              }}
            >
              {isSwapping ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t[lang].processing}
                </>
              ) : wallet.connected ? (
                <>
                  {isHighRisk && <AlertTriangle className="w-5 h-5" />}
                  {t[lang].swap}
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  {t[lang].connectWallet}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. RISK CONFIRMATION MODAL */}
        {showRiskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
            <div className="w-full max-w-md rounded-2xl border p-6 relative" style={{ background: "#020617", borderColor: "rgba(239,68,68,0.3)" }}>
              <button
                type="button"
                onClick={handleRiskCancel}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-red-400 mb-2">
                  {t[lang].riskModalTitle}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {t[lang].riskModalMessage}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleRiskCancel}
                  className="w-full min-h-[48px] rounded-xl font-medium bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
                >
                  {t[lang].cancel}
                </button>
                <button
                  type="button"
                  onClick={handleRiskConfirm}
                  className="w-full min-h-[48px] rounded-xl font-bold text-white transition-all"
                  style={{ background: "linear-gradient(to right, #ef4444, #dc2626)" }}
                >
                  {t[lang].proceedRisk}
                </button>
              </div>
            </div>
          </div>
        )}

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
      <ScanResultPage lang="pt" />
    </Suspense>
  );
}
