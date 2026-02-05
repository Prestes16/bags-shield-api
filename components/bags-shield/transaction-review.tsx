"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  ShieldCheck,
  Info,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Home,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

// Types
type ActionType = "swap" | "buy" | "sell" | "approve" | "transfer";
type RiskLevel = "low" | "medium" | "high";

interface TransactionData {
  actionType: ActionType;
  tokenSymbol: string;
  tokenAmount: string;
  inputValue: string;
  outputValue?: string;
  networkFee: string;
  priorityFee: string;
  totalEstimated: string;
  contractAddress: string;
  riskLevel: RiskLevel;
}

interface TransactionReviewProps {
  transaction: TransactionData;
  isOpen?: boolean;
  onConfirm?: () => Promise<void>;
  onCancel?: () => void;
}

// Default mock data
const defaultTransaction: TransactionData = {
  actionType: "swap",
  tokenSymbol: "BONK",
  tokenAmount: "1,500,000",
  inputValue: "1.5 SOL",
  outputValue: "1,500,000 BONK",
  networkFee: "~0.00005 SOL",
  priorityFee: "0.0001 SOL",
  totalEstimated: "1.50015 SOL",
  contractAddress: "8xFk3aJp9mNqW2vL5tRc7yHn4bKs6dEu8zXm1wQj3k3a",
  riskLevel: "low",
};

// Risk level configuration
const riskConfig = {
  low: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: ShieldCheck,
    iconColor: "text-emerald-400",
  },
  medium: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  high: {
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
};

// Wallet Approval Overlay
function WalletApprovalOverlay({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
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
          {t.txReview.waitingApproval}
        </h3>
        <p className="text-slate-400 text-sm max-w-xs">
          {t.txReview.approveInWallet}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <ExternalLink className="w-3 h-3" />
          <span>{t.txReview.checkExtension}</span>
        </div>
      </div>
    </div>
  );
}

// Hold to Confirm Button Component
function HoldToConfirmButton({
  onComplete,
  isLoading,
  riskLevel,
  t,
}: {
  onComplete: () => void;
  isLoading: boolean;
  riskLevel: RiskLevel;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdDuration = 1500; // 1.5 seconds
  const tickInterval = 16; // ~60fps

  const startHold = useCallback(() => {
    if (isLoading || isComplete) return;
    setIsHolding(true);
    const increment = (tickInterval / holdDuration) * 100;
    
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsComplete(true);
          return 100;
        }
        return next;
      });
    }, tickInterval);
  }, [isLoading, isComplete, holdDuration]);

  const stopHold = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsHolding(false);
    if (!isComplete) {
      setProgress(0);
    }
  }, [isComplete]);

  // Trigger onComplete via useEffect to avoid setState during render
  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isHighRisk = riskLevel === "high";
  const buttonGradient = isHighRisk
    ? "from-red-600 to-orange-600"
    : "from-amber-600 to-orange-600";
  const progressGradient = isHighRisk
    ? "from-red-500 to-orange-500"
    : "from-amber-500 to-orange-500";

  return (
    <button
      type="button"
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      onTouchCancel={stopHold}
      disabled={isLoading}
      className={cn(
        "relative w-full h-14 rounded-xl font-semibold text-white overflow-hidden transition-all",
        "bg-gradient-to-r",
        buttonGradient,
        isLoading && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Progress fill */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r transition-all",
          progressGradient
        )}
        style={{ 
          width: `${progress}%`,
          opacity: isHolding ? 0.4 : 0 
        }}
      />
      
      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t.common.loading}</span>
          </>
        ) : isHolding ? (
          <span>{t.txReview.holding}</span>
        ) : (
          <span>{t.txReview.holdToConfirm}</span>
        )}
      </span>
    </button>
  );
}

// Main Component
export function TransactionReview({
  transaction = defaultTransaction,
  isOpen = true,
  onConfirm,
  onCancel,
}: TransactionReviewProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingWallet, setIsWaitingWallet] = useState(false);

  const risk = riskConfig[transaction.riskLevel];
  const RiskIcon = risk.icon;
  const truncatedContract = `${transaction.contractAddress.slice(0, 6)}...${transaction.contractAddress.slice(-4)}`;
  const requiresHold = transaction.riskLevel === "medium" || transaction.riskLevel === "high";

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
        // Simulate wallet approval delay
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      router.push("/progress");
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsLoading(false);
      setIsWaitingWallet(false);
    }
  };

  const getActionLabel = () => {
    switch (transaction.actionType) {
      case "buy":
        return t.txReview.buying;
      case "sell":
        return t.txReview.selling;
      case "swap":
        return t.txReview.swapping;
      case "approve":
        return t.txReview.approving;
      default:
        return t.txReview.swapping;
    }
  };

  const getRiskNotice = () => {
    switch (transaction.riskLevel) {
      case "low":
        return t.txReview.lowRiskNotice;
      case "medium":
        return t.txReview.mediumRiskNotice;
      case "high":
        return t.txReview.highRiskNotice;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {isWaitingWallet && <WalletApprovalOverlay t={t} />}

      <div className="min-h-screen bg-bg-page">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-page/95 backdrop-blur-md border-b border-border-subtle">
          <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancel}
              className="w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-semibold text-text-primary">
              {t.txReview.title}
            </h1>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-muted hover:text-[var(--cyan-primary)] hover:bg-bg-card-hover active:scale-95 transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50"
              aria-label="Go home"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-md mx-auto px-4 pt-6 pb-32">
          {/* Action Hero */}
          <div className={cn(
            "rounded-2xl p-5 mb-5 border",
            "bg-gradient-to-br from-bg-card to-transparent",
            risk.borderColor
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                risk.bgColor
              )}>
                <ArrowRightLeft className={cn("w-6 h-6", risk.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-muted text-sm mb-0.5">{getActionLabel()}</p>
                <p className="text-xl font-bold text-text-primary truncate">
                  {transaction.tokenAmount} {transaction.tokenSymbol}
                </p>
                <p className="text-text-secondary text-sm">
                  {t.txReview.for} {transaction.inputValue}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-bg-card border border-border-subtle rounded-xl mb-5">
            <div className="px-4 py-3 border-b border-border-subtle">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                {t.txReview.summary}
              </h3>
            </div>
            
            <div className="p-4 space-y-0">
              {/* Amount */}
              <div className="flex justify-between py-2.5 border-b border-dashed border-border-subtle">
                <span className="text-text-muted text-sm">{t.txReview.baseValue}</span>
                <span className="text-text-primary font-medium text-sm">{transaction.inputValue}</span>
              </div>
              
              {/* Network Fee */}
              <div className="flex justify-between py-2.5 border-b border-dashed border-border-subtle">
                <span className="text-text-muted text-sm">{t.txReview.networkFee}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium text-sm">{transaction.networkFee}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                    LOW
                  </span>
                </div>
              </div>
              
              {/* Priority Fee */}
              <div className="flex justify-between py-2.5 border-b border-dashed border-border-subtle">
                <span className="text-text-muted text-sm">{t.txReview.priorityFee}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium text-sm">{transaction.priorityFee}</span>
                  <button 
                    type="button"
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                  >
                    {t.txReview.edit}
                  </button>
                </div>
              </div>
              
              {/* Contract */}
              <div className="flex justify-between py-2.5 border-b border-dashed border-border-subtle">
                <span className="text-text-muted text-sm">{t.txReview.contractInteraction}</span>
                <span className="text-text-secondary font-mono text-sm">{truncatedContract}</span>
              </div>
              
              {/* Total */}
              <div className="flex justify-between pt-3">
                <span className="text-text-primary font-semibold">{t.txReview.totalEstimated}</span>
                <span className="text-text-primary font-bold text-lg">{transaction.totalEstimated}</span>
              </div>
            </div>
          </div>

          {/* Risk Warning */}
          <div className={cn(
            "rounded-xl p-4 border",
            risk.bgColor,
            risk.borderColor
          )}>
            <div className="flex gap-3">
              <RiskIcon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", risk.iconColor)} />
              <div>
                <p className="text-xs font-semibold text-text-primary mb-1 uppercase tracking-wider">
                  {t.txReview.riskWarning}
                </p>
                <p className={cn("text-sm", risk.color)}>
                  {getRiskNotice()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Sheet */}
        <div className="fixed bottom-0 left-0 right-0 bg-bg-page/95 backdrop-blur-md border-t border-border-subtle">
          <div className="max-w-md mx-auto px-4 py-4 pb-8 space-y-3">
            {requiresHold ? (
              <HoldToConfirmButton
                onComplete={handleConfirm}
                isLoading={isLoading}
                riskLevel={transaction.riskLevel}
                t={t}
              />
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className={cn(
                  "w-full h-14 rounded-xl font-semibold text-white transition-all",
                  "bg-gradient-to-r from-cyan-500 to-blue-600",
                  "hover:from-cyan-400 hover:to-blue-500",
                  "shadow-[0_0_20px_rgba(34,211,238,0.2)]",
                  "hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.common.loading}
                  </span>
                ) : (
                  t.txReview.confirmSign
                )}
              </button>
            )}
            
            <button
              type="button"
              onClick={handleCancel}
              className="w-full h-11 rounded-xl font-medium text-text-secondary bg-bg-card border border-border-subtle hover:bg-bg-card-hover transition-colors"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Export wrapper for page usage
export function TransactionReviewPage() {
  const [mockRisk] = useState<RiskLevel>("medium"); // Can be changed for testing

  const transaction: TransactionData = {
    actionType: "swap",
    tokenSymbol: "BONK",
    tokenAmount: "1,500,000",
    inputValue: "1.5 SOL",
    outputValue: "1,500,000 BONK",
    networkFee: "~0.00005 SOL",
    priorityFee: "0.0001 SOL",
    totalEstimated: "1.50015 SOL",
    contractAddress: "8xFk3aJp9mNqW2vL5tRc7yHn4bKs6dEu8zXm1wQj3k3a",
    riskLevel: mockRisk,
  };

  return <TransactionReview transaction={transaction} />;
}
