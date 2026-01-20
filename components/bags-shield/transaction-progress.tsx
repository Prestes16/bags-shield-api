"use client";

import React from "react"

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  X,
  Pen,
  Wifi,
  Box,
  Flag,
  ExternalLink,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TransactionStatus = "processing" | "success" | "failed";
type StepStatus = "pending" | "active" | "completed" | "failed";

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: StepStatus;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "error";
}

interface TransactionProgressProps {
  txSignature?: string;
  onComplete?: () => void;
  onBack?: () => void;
  simulateProgress?: boolean;
}

export function TransactionProgress({
  txSignature = "8xF7k...3a9Bz",
  onComplete,
  onBack,
  simulateProgress = true,
}: TransactionProgressProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TransactionStatus>("processing");
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const initialSteps: Step[] = [
    {
      id: "signature",
      label: "Wallet Signature",
      icon: <Pen className="w-4 h-4" />,
      status: "active",
    },
    {
      id: "sending",
      label: "Sending to Solana Network",
      icon: <Wifi className="w-4 h-4" />,
      status: "pending",
    },
    {
      id: "confirming",
      label: "Confirming Block",
      icon: <Box className="w-4 h-4" />,
      status: "pending",
    },
    {
      id: "finalizing",
      label: "Finalizing",
      icon: <Flag className="w-4 h-4" />,
      status: "pending",
    },
  ];

  const [steps, setSteps] = useState<Step[]>(initialSteps);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev.slice(-5), { timestamp, message, type }]);
  }, []);

  // Simulate transaction progress
  useEffect(() => {
    if (!simulateProgress) return;

    const progressSteps = [
      { delay: 1000, step: 0, log: "Requesting wallet signature...", logType: "info" as const },
      { delay: 2500, step: 1, log: "Signature received from wallet", logType: "success" as const },
      { delay: 3500, step: 1, log: `Broadcasting tx: ${txSignature}`, logType: "info" as const },
      { delay: 5000, step: 2, log: "Transaction sent to Solana network", logType: "success" as const },
      { delay: 6500, step: 2, log: "Waiting for block confirmation...", logType: "info" as const },
      { delay: 8000, step: 3, log: "Block confirmed (slot: 234,891,234)", logType: "success" as const },
      { delay: 9500, step: 3, log: "Finalizing transaction...", logType: "info" as const },
      { delay: 11000, step: 4, log: "Transaction finalized successfully!", logType: "success" as const },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    progressSteps.forEach(({ delay, step, log, logType }) => {
      const timeout = setTimeout(() => {
        setCurrentStep(step);
        addLog(log, logType);

        // Update steps status
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status:
              idx < step
                ? "completed"
                : idx === step
                  ? step === 4
                    ? "completed"
                    : "active"
                  : "pending",
          }))
        );

        // Final state
        if (step === 4) {
          setStatus("success");
        }
      }, delay);
      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [simulateProgress, txSignature, addLog]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/");
    }
  };

  const handleViewOnSolscan = () => {
    window.open(`https://solscan.io/tx/${txSignature}`, "_blank");
  };

  const getStatusTitle = () => {
    switch (status) {
      case "processing":
        return "Processing Transaction...";
      case "success":
        return "Transaction Complete!";
      case "failed":
        return "Transaction Failed";
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex flex-col relative overflow-hidden">
      {/* Radar Pulse Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-96 h-96">
          <div
            className={cn(
              "absolute inset-0 rounded-full border border-cyan-500/20",
              status === "processing" && "animate-ping"
            )}
            style={{ animationDuration: "3s" }}
          />
          <div
            className={cn(
              "absolute inset-8 rounded-full border border-cyan-500/15",
              status === "processing" && "animate-ping"
            )}
            style={{ animationDuration: "3.5s", animationDelay: "0.5s" }}
          />
          <div
            className={cn(
              "absolute inset-16 rounded-full border border-cyan-500/10",
              status === "processing" && "animate-ping"
            )}
            style={{ animationDuration: "4s", animationDelay: "1s" }}
          />
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 relative z-10">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="w-20" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* Status Indicator */}
          <div className="flex flex-col items-center space-y-4">
            {/* Animated Icon */}
            <div className="relative">
              {status === "processing" && (
                <>
                  {/* Spinning ring */}
                  <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
                  <div
                    className="absolute inset-0 w-24 h-24 rounded-full border-2 border-transparent border-b-blue-500 animate-spin"
                    style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                  />
                  {/* Logo */}
                  <div className="w-24 h-24 rounded-full bg-slate-900/80 flex items-center justify-center">
                    <Image
                      src="/images/bags-shield-logo.png"
                      alt="Bags Shield"
                      width={48}
                      height={48}
                      className="opacity-80"
                    />
                  </div>
                </>
              )}

              {status === "success" && (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center animate-in zoom-in duration-300">
                  <Check className="w-12 h-12 text-white" strokeWidth={3} />
                </div>
              )}

              {status === "failed" && (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center animate-in zoom-in duration-300">
                  <X className="w-12 h-12 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            {/* Status Title */}
            <h2
              className={cn(
                "text-xl font-semibold text-center",
                status === "processing" && "text-white animate-pulse",
                status === "success" && "text-emerald-400",
                status === "failed" && "text-red-400"
              )}
            >
              {getStatusTitle()}
            </h2>
          </div>

          {/* Stepper Timeline */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
            <div className="space-y-1">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3">
                  {/* Step indicator column */}
                  <div className="flex flex-col items-center">
                    {/* Icon circle */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                        step.status === "pending" && "bg-slate-700/50 text-slate-500",
                        step.status === "active" && "bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-400/50",
                        step.status === "completed" && "bg-emerald-500/20 text-emerald-400",
                        step.status === "failed" && "bg-red-500/20 text-red-400"
                      )}
                    >
                      {step.status === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : step.status === "active" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    {/* Connector line */}
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-8 transition-all duration-300",
                          step.status === "completed" ? "bg-emerald-500/50" : "bg-slate-700/50"
                        )}
                      />
                    )}
                  </div>

                  {/* Step label */}
                  <div className="pt-1.5">
                    <span
                      className={cn(
                        "text-sm font-medium transition-all duration-300",
                        step.status === "pending" && "text-slate-500 opacity-50",
                        step.status === "active" && "text-white",
                        step.status === "completed" && "text-emerald-400",
                        step.status === "failed" && "text-red-400"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Console Logs (Matrix Style) */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-emerald-900/30 p-3 min-h-[100px]">
            <div className="space-y-1 font-mono text-xs">
              {logs.length === 0 && (
                <p className="text-emerald-600/50">{">"} Initializing...</p>
              )}
              {logs.map((log, index) => (
                <p
                  key={index}
                  className={cn(
                    "transition-all duration-200",
                    log.type === "info" && "text-emerald-500/80",
                    log.type === "success" && "text-emerald-400",
                    log.type === "error" && "text-red-400"
                  )}
                >
                  <span className="text-emerald-700">[{log.timestamp}]</span>{" "}
                  <span className="text-emerald-600">{">"}</span> {log.message}
                </p>
              ))}
              {status === "processing" && (
                <p className="text-emerald-500/60 animate-pulse">
                  <span className="text-emerald-700">[--:--:--]</span>{" "}
                  <span className="text-emerald-600">{">"}</span> _
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* View on Solscan - visible after sending */}
            {currentStep >= 1 && (
              <Button
                onClick={handleViewOnSolscan}
                variant="outline"
                className="w-full bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Solscan
              </Button>
            )}

            {/* Done button - only on completion */}
            {(status === "success" || status === "failed") && (
              <Button
                onClick={onComplete || handleBack}
                className={cn(
                  "w-full font-semibold",
                  status === "success"
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
                    : "bg-slate-700 hover:bg-slate-600 text-white"
                )}
              >
                {status === "success" ? "Done" : "Back to Dashboard"}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-4 text-center relative z-10">
        <p className="text-xs text-slate-600">
          Powered by Bags Shield
        </p>
      </footer>
    </div>
  );
}

// Skeleton Loading State
export function TransactionProgressSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <header className="flex items-center px-4 py-3">
        <div className="w-16 h-5 bg-white/10 rounded animate-pulse" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* Status indicator skeleton */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-white/10 animate-pulse" />
            <div className="w-48 h-6 bg-white/10 rounded animate-pulse" />
          </div>

          {/* Stepper skeleton */}
          <div className="bg-white/5 rounded-2xl p-5 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                <div className="w-32 h-4 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Console skeleton */}
          <div className="bg-black/40 rounded-xl p-3 h-24">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full h-3 bg-emerald-900/30 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
