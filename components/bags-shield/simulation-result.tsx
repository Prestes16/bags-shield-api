"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCircle,
  AlertOctagon,
  Check,
  AlertTriangle,
  Shield,
  Zap,
  ArrowRight,
  Copy,
  ExternalLink,
} from "lucide-react";

interface SimulationData {
  status: "pass" | "fail";
  riskLevel: "low" | "medium" | "high";
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
  logs: {
    type: "success" | "warning" | "error";
    message: string;
  }[];
  errorMessage?: string;
}

interface SimulationResultProps {
  data?: SimulationData;
  isLoading?: boolean;
  onClose?: () => void;
  onProceed?: () => void;
  onViewLogs?: () => void;
}

// Skeleton Loading Component
function SimulationResultSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header Skeleton */}
      <header className="px-5 py-4 flex items-center justify-between">
        <div className="h-6 w-48 bg-white/10 rounded-lg animate-pulse" />
        <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
      </header>

      <main className="flex-1 px-5 pb-6 space-y-4">
        {/* Hero Card Skeleton */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 animate-pulse mb-4" />
            <div className="h-7 w-48 bg-white/10 rounded-lg animate-pulse mb-2" />
            <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
          </div>
        </div>

        {/* Financial Summary Skeleton */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
          <div className="h-5 w-36 bg-white/10 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                <div className="h-6 w-28 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Logs Skeleton */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 animate-pulse" />
                <div className="h-4 flex-1 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="space-y-3 pt-2">
          <div className="h-14 w-full bg-white/10 rounded-xl animate-pulse" />
          <div className="h-12 w-full bg-white/10 rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}

const defaultPassData: SimulationData = {
  status: "pass",
  riskLevel: "low",
  input: { amount: 1.0, token: "SOL" },
  output: { amount: 950000, token: "BONK" },
  priceImpact: 0.08,
  networkFee: 0.00005,
  logs: [
    { type: "success", message: "Honeypot Check Passed" },
    { type: "success", message: "Transfer Tax: 0%" },
    { type: "warning", message: "Slippage ajustado para 2%" },
    { type: "success", message: "Liquidity Depth: Sufficient" },
  ],
};

const defaultFailData: SimulationData = {
  status: "fail",
  riskLevel: "high",
  input: { amount: 1.0, token: "SOL" },
  output: { amount: 0, token: "SCAM" },
  priceImpact: 99.9,
  networkFee: 0.00005,
  logs: [
    { type: "error", message: "Honeypot Detected" },
    { type: "error", message: "Transfer Tax: 99%" },
    { type: "warning", message: "Liquidity Lock: None" },
  ],
  errorMessage: "Token possui restricoes de transferencia que impedem a venda.",
};

export function SimulationResult({
  data,
  isLoading = false,
  onClose,
  onProceed,
  onViewLogs,
}: SimulationResultProps) {
  const router = useRouter();
  const [showDemo, setShowDemo] = useState<"pass" | "fail">("pass");

  // Use provided data or demo data
  const simulationData = data || (showDemo === "pass" ? defaultPassData : defaultFailData);
  const isPassed = simulationData.status === "pass";

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const handleProceed = () => {
    if (onProceed) {
      onProceed();
    } else {
      // Default: navigate to confirm transaction
      router.push("/confirm");
    }
  };

  const handleViewLogs = () => {
    if (onViewLogs) {
      onViewLogs();
    } else {
      console.log("Viewing error logs...");
    }
  };

  if (isLoading) {
    return <SimulationResultSkeleton />;
  }

  const getRiskBadgeStyles = () => {
    switch (simulationData.riskLevel) {
      case "low":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getLogIcon = (type: "success" | "warning" | "error") => {
    switch (type) {
      case "success":
        return <Check className="w-4 h-4 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "error":
        return <AlertOctagon className="w-4 h-4 text-red-400" />;
    }
  };

  const getLogBgColor = (type: "success" | "warning" | "error") => {
    switch (type) {
      case "success":
        return "bg-emerald-500/10";
      case "warning":
        return "bg-yellow-500/10";
      case "error":
        return "bg-red-500/10";
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Resultado da Simulacao</h1>
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-200"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </header>

      {/* Demo Toggle (only when no data provided) */}
      {!data && (
        <div className="px-5 mb-4">
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setShowDemo("pass")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                showDemo === "pass"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Demo: Pass
            </button>
            <button
              type="button"
              onClick={() => setShowDemo("fail")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                showDemo === "fail"
                  ? "bg-red-500/20 text-red-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Demo: Fail
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 px-5 pb-6 space-y-4 max-w-xl mx-auto w-full">
        {/* Hero Status Card */}
        <div
          className={`bg-white/5 backdrop-blur-xl rounded-2xl border p-6 transition-all duration-300 ${
            isPassed
              ? "border-emerald-500/30 shadow-lg shadow-emerald-500/10"
              : "border-red-500/30 shadow-lg shadow-red-500/10"
          }`}
        >
          <div className="flex flex-col items-center text-center">
            {/* Status Icon */}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                isPassed
                  ? "bg-emerald-500/20 shadow-lg shadow-emerald-500/25"
                  : "bg-red-500/20 shadow-lg shadow-red-500/25"
              }`}
            >
              {isPassed ? (
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              ) : (
                <AlertOctagon className="w-10 h-10 text-red-400" />
              )}
            </div>

            {/* Status Title */}
            <h2
              className={`text-xl font-bold mb-2 ${
                isPassed ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isPassed ? "Simulacao Aprovada" : "Falha na Simulacao"}
            </h2>

            {/* Risk Badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium ${getRiskBadgeStyles()}`}
            >
              <Shield className="w-4 h-4" />
              Risk: {simulationData.riskLevel.charAt(0).toUpperCase() + simulationData.riskLevel.slice(1)}
            </div>

            {/* Error Message (if failed) */}
            {!isPassed && simulationData.errorMessage && (
              <p className="text-red-300/80 text-sm mt-4 leading-relaxed">
                {simulationData.errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Resumo Financeiro
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Input */}
            <div className="space-y-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Entrada</span>
              <p className="text-white font-bold text-lg">
                {simulationData.input.amount} {simulationData.input.token}
              </p>
            </div>

            {/* Output */}
            <div className="space-y-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Saida Estimada</span>
              <p className={`font-bold text-lg ${isPassed ? "text-emerald-400" : "text-red-400"}`}>
                {isPassed
                  ? `~${simulationData.output.amount.toLocaleString()} ${simulationData.output.token}`
                  : "N/A"}
              </p>
            </div>

            {/* Price Impact */}
            <div className="space-y-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Price Impact</span>
              <p
                className={`font-bold text-lg ${
                  simulationData.priceImpact < 1
                    ? "text-emerald-400"
                    : simulationData.priceImpact < 5
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {simulationData.priceImpact < 1 ? "< " : ""}
                {simulationData.priceImpact.toFixed(1)}%
              </p>
            </div>

            {/* Network Fee */}
            <div className="space-y-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Network Fee</span>
              <p className="text-slate-300 font-medium">
                {simulationData.networkFee} SOL
              </p>
            </div>
          </div>
        </div>

        {/* Simulation Logs Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-cyan-400" />
            Log de Verificacoes
          </h3>

          <div className="space-y-2">
            {simulationData.logs.map((log, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl ${getLogBgColor(log.type)}`}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                  {getLogIcon(log.type)}
                </div>
                <span
                  className={`text-sm font-medium ${
                    log.type === "success"
                      ? "text-slate-200"
                      : log.type === "warning"
                      ? "text-yellow-200"
                      : "text-red-200"
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {isPassed ? (
            <>
              {/* Proceed Button */}
              <button
                type="button"
                onClick={handleProceed}
                className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3"
              >
                Proceed to Apply
                <ArrowRight className="w-5 h-5" />
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3.5 rounded-xl font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {/* Back to Dashboard Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-4 rounded-xl font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-all duration-300 flex items-center justify-center gap-3"
              >
                Back to Dashboard
              </button>

              {/* View Error Logs Button */}
              <button
                type="button"
                onClick={handleViewLogs}
                className="w-full py-3.5 rounded-xl font-medium text-red-400 bg-transparent hover:bg-red-500/10 border border-red-500/30 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Error Logs
              </button>
            </>
          )}
        </div>
      </main>

      {/* Home Indicator */}
      <div className="flex justify-center pb-4">
        <div className="w-32 h-1 bg-slate-700 rounded-full" />
      </div>
    </div>
  );
}
