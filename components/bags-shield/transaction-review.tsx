"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  ShieldCheck,
  Info,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionType = "swap" | "revoke" | "approve" | "transfer";
type RiskLevel = "low" | "medium" | "high";

interface TransactionData {
  actionType: ActionType;
  actionLabel: string;
  tokenSymbol: string;
  tokenAmount: string;
  baseValue: string;
  networkFee: string;
  priorityFee: string;
  totalEstimated: string;
  contractAddress: string;
  riskLevel: RiskLevel;
}

interface TransactionReviewProps {
  transaction?: TransactionData;
  onConfirm?: () => Promise<void>;
  onCancel?: () => void;
}

const defaultTransaction: TransactionData = {
  actionType: "swap",
  actionLabel: "Comprando",
  tokenSymbol: "BONK",
  tokenAmount: "1,500,000",
  baseValue: "1.5 SOL",
  networkFee: "~0.00005 SOL",
  priorityFee: "0.0001 SOL",
  totalEstimated: "1.50015 SOL",
  contractAddress: "8xFk3aJp9mNqW2vL5tRc7yHn4bKs6dEu8zXm1wQj3k3a",
  riskLevel: "low",
};

const actionIcons: Record<ActionType, typeof ArrowRightLeft> = {
  swap: ArrowRightLeft,
  revoke: ShieldCheck,
  approve: Check,
  transfer: ArrowRightLeft,
};

// Skeleton Loading Component
function TransactionReviewSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page text-white">
      <div className="max-w-md mx-auto px-4 pt-4 pb-32 md:pb-8 md:pt-12">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
          <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
          <div className="w-16" />
        </div>

        {/* Hero Card Skeleton */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full animate-pulse mb-4" />
            <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
          </div>
        </div>

        {/* Receipt Skeleton */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 mb-6">
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-4" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex justify-between py-3 border-b border-dashed border-white/10 last:border-0"
            >
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Security Banner Skeleton */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <div className="w-5 h-5 bg-white/10 rounded animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse mt-2" />
            </div>
          </div>
        </div>

        {/* Button Skeleton */}
        <div className="h-14 w-full bg-white/10 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// Wallet Approval Overlay
function WalletApprovalOverlay() {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center px-6">
        <div className="relative mb-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
          <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full border-2 border-cyan-500/30 animate-ping" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Aguardando Aprovacao
        </h3>
        <p className="text-slate-400 text-sm max-w-xs">
          Por favor, confirme a transacao na sua carteira para continuar...
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <ExternalLink className="w-3 h-3" />
          <span>Verifique sua extensao Phantom</span>
        </div>
      </div>
    </div>
  );
}

export function TransactionReview({
  transaction = defaultTransaction,
  onConfirm,
  onCancel,
}: TransactionReviewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingWallet, setIsWaitingWallet] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const ActionIcon = actionIcons[transaction.actionType];
  const isHighRisk = transaction.riskLevel === "high";
  const truncatedContract = `${transaction.contractAddress.slice(0, 4)}...${transaction.contractAddress.slice(-4)}`;

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setIsWaitingWallet(true);

    try {
      if (onConfirm) {
        await onConfirm();
      } else {
        // Simulate wallet approval
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      router.push("/progress");
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsLoading(false);
      setIsWaitingWallet(false);
    }
  };

  // Long press handler for high risk actions
  const handleMouseDown = () => {
    if (!isHighRisk) return;
    setIsHolding(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsHolding(false);
        setHoldProgress(0);
        handleConfirm();
      }
    }, 30);

    const handleMouseUp = () => {
      clearInterval(interval);
      setIsHolding(false);
      setHoldProgress(0);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
  };

  if (isLoading && !isWaitingWallet) {
    return <TransactionReviewSkeleton />;
  }

  return (
    <>
      {isWaitingWallet && <WalletApprovalOverlay />}

      <div className="min-h-screen bg-bg-page text-white">
        <div className="max-w-md mx-auto px-4 pt-4 pb-32 md:pb-8 md:pt-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={handleCancel}
              className="text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <h1 className="text-lg font-semibold text-white">Confirmar Acao</h1>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>

          {/* Hero Action Card */}
          <div
            className={cn(
              "bg-white/5 backdrop-blur-sm border rounded-2xl p-6 mb-6 transition-all",
              isHighRisk
                ? "border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                : "border-white/10"
            )}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                  isHighRisk
                    ? "bg-gradient-to-br from-red-500/20 to-orange-500/20"
                    : "bg-gradient-to-br from-cyan-500/20 to-blue-500/20"
                )}
              >
                <ActionIcon
                  className={cn(
                    "w-8 h-8",
                    isHighRisk ? "text-red-400" : "text-cyan-400"
                  )}
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {transaction.actionLabel} {transaction.tokenSymbol}
              </h2>
              <p className="text-slate-400">Usando {transaction.baseValue}</p>
            </div>
          </div>

          {/* Receipt / Financial Breakdown */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">
              Detalhamento
            </h3>

            <div className="space-y-0">
              <div className="flex justify-between py-3 border-b border-dashed border-white/10">
                <span className="text-slate-400">Valor Base</span>
                <span className="text-white font-medium">
                  {transaction.baseValue}
                </span>
              </div>

              <div className="flex justify-between py-3 border-b border-dashed border-white/10">
                <span className="text-slate-400">Network Fee</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {transaction.networkFee}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                    LOW
                  </span>
                </div>
              </div>

              <div className="flex justify-between py-3 border-b border-dashed border-white/10">
                <span className="text-slate-400">Priority Fee</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {transaction.priorityFee}
                  </span>
                  <button className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                    Edit
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <span className="text-white font-semibold">Total Estimado</span>
                <span className="text-white font-bold text-lg">
                  {transaction.totalEstimated}
                </span>
              </div>
            </div>
          </div>

          {/* Security Banner */}
          <div
            className={cn(
              "border rounded-xl p-4 mb-6",
              isHighRisk
                ? "bg-red-900/20 border-red-500/30"
                : "bg-blue-900/20 border-blue-500/30"
            )}
          >
            <div className="flex gap-3">
              {isHighRisk ? (
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={cn(
                    "text-sm",
                    isHighRisk ? "text-red-200" : "text-blue-200"
                  )}
                >
                  {isHighRisk
                    ? "Esta acao envolve riscos elevados. Verifique os detalhes antes de confirmar."
                    : "Voce precisara aprovar esta transacao na sua carteira em seguida."}
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Action Zone */}
          <div className="hidden md:block">
            <Button
              onClick={isHighRisk ? undefined : handleConfirm}
              onMouseDown={isHighRisk ? handleMouseDown : undefined}
              onTouchStart={isHighRisk ? handleMouseDown : undefined}
              disabled={isLoading}
              className={cn(
                "w-full h-14 text-base font-semibold rounded-xl relative overflow-hidden transition-all",
                isHighRisk
                  ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white"
                  : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
              )}
            >
              {isHighRisk && isHolding && (
                <div
                  className="absolute inset-0 bg-white/20 transition-all"
                  style={{ width: `${holdProgress}%` }}
                />
              )}
              <span className="relative z-10">
                {isHighRisk
                  ? isHolding
                    ? "Segure para confirmar..."
                    : "SEGURAR PARA CONFIRMAR"
                  : "CONFIRM & SIGN"}
              </span>
            </Button>
            <p className="text-center text-slate-500 text-xs mt-3">
              Interacao com contrato:{" "}
              <span className="text-slate-400 font-mono">
                {truncatedContract}
              </span>
            </p>
          </div>
        </div>

        {/* Mobile Fixed Action Zone */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-page/95 backdrop-blur-md border-t border-white/10 p-4 pb-8">
          <Button
            onClick={isHighRisk ? undefined : handleConfirm}
            onMouseDown={isHighRisk ? handleMouseDown : undefined}
            onTouchStart={isHighRisk ? handleMouseDown : undefined}
            disabled={isLoading}
            className={cn(
              "w-full h-14 text-base font-semibold rounded-xl relative overflow-hidden transition-all",
              isHighRisk
                ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white"
                : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
            )}
          >
            {isHighRisk && isHolding && (
              <div
                className="absolute inset-0 bg-white/20 transition-all"
                style={{ width: `${holdProgress}%` }}
              />
            )}
            <span className="relative z-10">
              {isHighRisk
                ? isHolding
                  ? "Segure para confirmar..."
                  : "SEGURAR PARA CONFIRMAR"
                : "CONFIRM & SIGN"}
            </span>
          </Button>
          <p className="text-center text-slate-500 text-xs mt-3">
            Interacao com contrato:{" "}
            <span className="text-slate-400 font-mono">{truncatedContract}</span>
          </p>
        </div>
      </div>
    </>
  );
}

// Demo wrapper to test different states
export function TransactionReviewDemo() {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");

  const transaction: TransactionData = {
    actionType: riskLevel === "high" ? "approve" : "swap",
    actionLabel: riskLevel === "high" ? "Aprovando" : "Comprando",
    tokenSymbol: "BONK",
    tokenAmount: "1,500,000",
    baseValue: "1.5 SOL",
    networkFee: "~0.00005 SOL",
    priorityFee: "0.0001 SOL",
    totalEstimated: "1.50015 SOL",
    contractAddress: "8xFk3aJp9mNqW2vL5tRc7yHn4bKs6dEu8zXm1wQj3k3a",
    riskLevel,
  };

  return (
    <div className="relative">
      {/* Demo Toggle */}
      <div className="fixed top-4 right-4 z-40 bg-white/10 backdrop-blur-sm rounded-lg p-2 flex gap-2">
        <button
          onClick={() => setRiskLevel("low")}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-medium transition-all",
            riskLevel === "low"
              ? "bg-blue-500 text-white"
              : "text-slate-400 hover:text-white"
          )}
        >
          Low Risk
        </button>
        <button
          onClick={() => setRiskLevel("high")}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-medium transition-all",
            riskLevel === "high"
              ? "bg-red-500 text-white"
              : "text-slate-400 hover:text-white"
          )}
        >
          High Risk
        </button>
      </div>

      <TransactionReview transaction={transaction} />
    </div>
  );
}
