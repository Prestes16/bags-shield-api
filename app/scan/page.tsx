"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Home, AlertCircle, Loader2, Lock, Shield, Share2, Coins, AlertTriangle, X } from "lucide-react";
import { backendClient, type ScanResult } from "@/lib/backend-client";
import { InlineScanInput } from "@/components/bags-shield/quick-scan-modal";
import { ShareSheet, type ShareData } from "@/components/bags-shield/share-sheet";
import { useWallet } from "@/lib/wallet/wallet-context";
import { addScanToHistory } from "@/lib/scan-history";
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
    newScan: "Novo Scan",
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
    newScan: "New Scan",
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
          
          // Add to scan history
          addScanToHistory({
            mint: result.tokenInfo.mint,
            tokenName: result.tokenInfo.name || "Unknown Token",
            tokenSymbol: result.tokenInfo.symbol || "???",
            score: result.security.score,
            grade: result.security.grade,
            isSafe: result.security.isSafe,
          });
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

    // 3. RISK LOGIC: Show modal if token is unsafe (based on isSafe field, not score threshold)
    if (scanData && !scanData.security.isSafe) {
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

  // Execute swap with Jupiter Ultra API and Phantom wallet
  const executeSwap = async (swapAmount: string, userAcceptedRisk: boolean = false) => {
    if (!swapAmount || !scanData || !wallet.publicKey) return;

    setIsSwapping(true);
    setErrorMessage("");

    try {
      console.log("[v0] Starting swap for", swapAmount, "SOL");

      // Step 1: Create order with Jupiter Ultra API
      const response = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: "So11111111111111111111111111111111111111112", // SOL
          outputMint: scanData.tokenInfo.mint,
          amount: Math.floor(parseFloat(swapAmount) * 1e9), // Convert to lamports
          userPublicKey: wallet.publicKey,
          isSafe: scanData.security.isSafe || false,
          userAcceptedRisk,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[v0] API error:", errorData);
        throw new Error(errorData.error || "Failed to create order");
      }

      const { transaction, quote, orderId } = await response.json();
      console.log("[v0] Order created:", orderId);
      console.log("[v0] Quote:", quote);

      setErrorMessage(`${t[lang].processing} (${lang === "pt" ? "Assine na carteira" : "Sign in wallet"})`);

      // Step 2: Deserialize versioned transaction and send via Phantom wallet
      const transactionBuffer = Buffer.from(transaction, "base64");
      const { VersionedTransaction } = await import("@solana/web3.js");
      const tx = VersionedTransaction.deserialize(transactionBuffer);

      console.log("[v0] Versioned transaction prepared, requesting signature...");

      // Sign and send via wallet context
      const signature = await wallet.signAndSendTransaction(tx);

      console.log("[v0] Transaction signed and sent:", signature);

      // Show success with signature
      setErrorMessage(
        lang === "pt" 
          ? `✓ Transação enviada! ${signature.slice(0, 8)}...` 
          : `✓ Transaction sent! ${signature.slice(0, 8)}...`
      );

      // Clear amount after successful swap
      setTimeout(() => {
        setAmount("");
        setErrorMessage("");
      }, 3000);

    } catch (error: any) {
      console.error("[v0] Swap error:", error);
      
      // Handle specific errors
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        setErrorMessage(lang === "pt" ? "Transação cancelada" : "Transaction cancelled");
      } else if (error.code === 4001) {
        setErrorMessage(lang === "pt" ? "Transação rejeitada" : "Transaction rejected");
      } else {
        setErrorMessage(error.message || `${t[lang].swap} ${lang === "pt" ? "falhou" : "failed"}`);
      }
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
        <div className="sticky top-0 z-10 backdrop-blur-xl border-b" style={{ background: "rgba(2,6,23,0.95)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <Home className="w-5 h-5" />
            </button>
            <span className="flex-1 text-center text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">
              {t[lang].securityReport}
            </span>
            <button
              type="button"
              onClick={() => {
                router.push("/scan");
                setScanData(null);
                setViewState("idle");
                setError("");
                setAmount("");
                setErrorMessage("");
              }}
              className="flex-shrink-0 px-3 h-10 rounded-lg flex items-center justify-center gap-2 text-cyan-400 hover:text-cyan-300 transition-all border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 font-medium text-xs sm:text-sm whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden xs:inline">{t[lang].newScan}</span>
              <span className="xs:hidden">Scan</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
            {/* Token Info Card */}
            <div className="bg-bg-card rounded-2xl p-5 mb-4 border border-border-subtle">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full blur-xl opacity-40"
                    style={{
                      background: `radial-gradient(circle, ${gradeGlow}, transparent)`,
                    }}
                  />
                  {tokenInfo.imageUrl ? (
                    <Image
                      src={tokenInfo.imageUrl || "/placeholder.svg"}
                      alt={tokenInfo.name}
                      width={64}
                      height={64}
                      className="relative rounded-full border-2"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = document.createElement("div");
                          fallback.className = "relative w-16 h-16 rounded-full border-2 flex items-center justify-center";
                          fallback.style.background = "rgba(255,255,255,0.05)";
                          fallback.style.borderColor = "rgba(255,255,255,0.1)";
                          fallback.innerHTML = '<svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" strokeWidth="2"/><circle cx="16" cy="9" r="4" strokeWidth="2"/></svg>';
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div
                      className="relative w-16 h-16 rounded-full border-2 flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      <Coins className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-white mb-0.5 truncate">
                    {tokenInfo.name}
                  </h1>
                  <p className="text-sm text-slate-400 font-mono">
                    ${tokenInfo.symbol}
                  </p>
                </div>
                {integrity.isVerified && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Verificado</span>
                  </div>
                )}
              </div>

              {/* Score Display */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-bg-page/50 to-bg-page/30 border border-border-subtle/50">
                <div>
                  <p className="text-xs text-text-muted mb-1 uppercase tracking-wider font-medium">
                    {t[lang].shieldScore}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      {security.score}
                    </span>
                    <span className="text-lg text-text-muted">/100</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-xs text-text-muted mb-1 uppercase tracking-wider font-medium">
                    {t[lang].grade}
                  </p>
                  <div
                    className={`px-4 py-2 rounded-xl font-bold text-2xl bg-gradient-to-br ${gradeColor} text-white shadow-lg`}
                    style={{ boxShadow: `0 0 16px ${gradeGlow}` }}
                  >
                    {security.grade}
                  </div>
                </div>
              </div>
            </div>

            {/* Security Warnings */}
            {(security.mintAuthority || security.freezeAuthority) && (
              <div className="mb-4 p-4 rounded-xl border bg-amber-500/5 border-amber-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-amber-400">
                    {t[lang].securityWarnings}
                  </h3>
                </div>
                <div className="space-y-2 pl-10">
                  {security.mintAuthority && (
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5" />
                      <p className="text-xs text-amber-200 leading-relaxed">
                        {t[lang].mintAuthority}
                      </p>
                    </div>
                  )}
                  {security.freezeAuthority && (
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5" />
                      <p className="text-xs text-amber-200 leading-relaxed">
                        {t[lang].freezeAuthority}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Findings */}
            {findings.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <span>{t[lang].findings}</span>
                  <span className="px-2 py-0.5 rounded-full bg-bg-card-hover text-xs font-medium text-text-muted">
                    {findings.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {findings.map((finding, idx) => {
                    const severityConfig = {
                      HIGH: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", icon: "bg-red-500/20", text: "text-red-400", pulse: true },
                      MEDIUM: { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.2)", icon: "bg-amber-500/20", text: "text-amber-400", pulse: false },
                      LOW: { bg: "rgba(59,130,246,0.05)", border: "rgba(59,130,246,0.2)", icon: "bg-blue-500/20", text: "text-blue-400", pulse: false },
                    };
                    const config = severityConfig[finding.severity];

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border"
                        style={{
                          background: config.bg,
                          borderColor: config.border,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg ${config.icon} flex items-center justify-center flex-shrink-0 ${config.pulse ? "animate-pulse" : ""}`}>
                            <AlertCircle className={`w-4 h-4 ${config.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold mb-1 ${config.text}`}>
                              {finding.label}
                            </p>
                            <p className="text-xs text-text-muted leading-relaxed">
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
              className="w-full h-12 rounded-xl font-medium text-text-secondary flex items-center justify-center gap-2 transition-all border border-border-subtle bg-bg-card hover:bg-bg-card-hover active:scale-98"
            >
              <Share2 className="w-4 h-4" />
              {t[lang].shareReport}
            </button>
          </div>
        </div>

        {/* Sticky Bottom: Native Swap Form */}
        <div className="fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl border-t px-4 py-4 pb-safe" style={{ background: "rgba(2,6,23,0.98)", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-bg-card rounded-2xl p-4 border border-border-subtle mb-3">
              {/* Input Section */}
              <div className="mb-3">
                <label className="text-xs font-semibold text-text-muted mb-2 block uppercase tracking-wider">
                  {t[lang].youPay} (SOL)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.01"
                    min="0"
                    className="w-full h-14 pl-4 pr-16 rounded-xl text-white text-xl font-bold border-2 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all bg-bg-input"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">
                    SOL
                  </div>
                </div>
              </div>

              {/* Arrow Divider */}
              <div className="flex justify-center my-2">
                <div className="w-8 h-8 rounded-lg bg-bg-page flex items-center justify-center">
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Receive Section */}
              <div>
                <label className="text-xs font-semibold text-text-muted mb-2 block uppercase tracking-wider">
                  {t[lang].youReceive}
                </label>
                <div className="h-14 px-4 rounded-xl bg-bg-page border-2 border-transparent flex items-center justify-between">
                  <span className="text-xl font-bold text-text-muted">~</span>
                  <span className="text-sm font-medium text-text-secondary">{tokenInfo.symbol}</span>
                </div>
              </div>
            </div>

            {/* Status Message */}
            {errorMessage && (
              <div className="mb-3 p-3 rounded-xl border bg-blue-500/10 border-blue-500/30">
                <p className="text-xs text-blue-400 text-center font-medium">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleSwapClick}
              disabled={!amount || parseFloat(amount) <= 0 || isSwapping}
              className="w-full h-14 rounded-xl font-bold text-white flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 text-base"
              style={{
                background: swapButtonColor,
                boxShadow: isHighRisk ? "0 0 24px rgba(239,68,68,0.5)" : "0 0 24px rgba(16,185,129,0.5)",
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
                  <span>{t[lang].swap}</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>{t[lang].connectWallet}</span>
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
