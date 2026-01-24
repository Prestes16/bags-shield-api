"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

type Step = 0 | 1 | 2 | 3 | 4;

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "error";
}

const steps = [
  { id: 0, label: "Enviando transação...", message: "Transaction broadcast initiated" },
  { id: 1, label: "Aguardando confirmação...", message: "Waiting for network confirmation" },
  { id: 2, label: "Processando...", message: "Transaction processing on-chain" },
  { id: 3, label: "Finalizando...", message: "Finalizing transaction" },
  { id: 4, label: "Confirmado!", message: "Transaction confirmed successfully" },
];

// Hash fictício para demonstração
const mockTxHash = "5KJp7mN9qR2sT8vW1xY3zA6bC4dE7fG0hI2jK5lM8nO1pQ4rS6tU9vW2xY5z";

export default function TransactionProgressPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [hasError, setHasError] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Adicionar log ao console fictício
  const addLog = (message: string, type: "info" | "success" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  // Scroll automático do console
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Simulação de progresso automático
  useEffect(() => {
    if (hasError) return; // Para se houver erro

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 4) {
          clearInterval(timer);
          return 4;
        }

        const nextStep = (prev + 1) as Step;
        addLog(steps[nextStep].message, nextStep === 4 ? "success" : "info");

        // Quando chegar no step 4, mostrar sucesso
        if (nextStep === 4) {
          setShowConfetti(true);
          // Remover confete após 3 segundos
          setTimeout(() => setShowConfetti(false), 3000);
        }

        return nextStep;
      });
    }, 1500);

    // Log inicial
    addLog(steps[0].message);

    return () => clearInterval(timer);
  }, [hasError]);

  // Função para simular erro (para teste)
  const simulateError = () => {
    setHasError(true);
    addLog("Transaction failed: Network timeout", "error");
  };

  // Função para retry
  const handleRetry = () => {
    setHasError(false);
    setCurrentStep(0);
    setLogs([]);
    addLog("Retrying transaction...", "info");
  };

  const isSuccess = currentStep === 4 && !hasError;
  const isFailed = hasError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8 relative overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <span className="text-2xl">🎉</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
            Progresso da Transação
          </h1>

          <div className="space-y-6">
            {/* Status Circle */}
            <div className="text-center py-8">
              <div className="relative inline-block">
                {/* Círculo de progresso */}
                <div
                  className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
                    isFailed
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                      : isSuccess
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  }`}
                >
                  {isFailed ? (
                    <svg
                      className="w-12 h-12 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : isSuccess ? (
                    <svg
                      className="w-12 h-12 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="animate-spin w-12 h-12 text-blue-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                </div>

                {/* Indicadores de step */}
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {steps[currentStep].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-2 rounded transition-colors ${
                    index <= currentStep && !hasError
                      ? "bg-green-50 dark:bg-green-900/20"
                      : index === currentStep && hasError
                      ? "bg-red-50 dark:bg-red-900/20"
                      : "bg-slate-50 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index < currentStep && !hasError
                        ? "bg-green-500 text-white"
                        : index === currentStep && !hasError
                        ? "bg-blue-500 text-white animate-pulse"
                        : index === currentStep && hasError
                        ? "bg-red-500 text-white"
                        : "bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {index < currentStep && !hasError ? "✓" : index + 1}
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Console Fictício */}
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs max-h-48 overflow-y-auto">
              <div className="text-green-400 mb-2">$ Transaction Console</div>
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-1 ${
                    log.type === "error"
                      ? "text-red-400"
                      : log.type === "success"
                      ? "text-green-400"
                      : "text-slate-400"
                  }`}
                >
                  <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            {/* Transaction Hash (quando sucesso) */}
            {isSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Transaction Hash
                </div>
                <div className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
                  {mockTxHash}
                </div>
              </div>
            )}

            {/* Error Message */}
            {isFailed && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                  Transação falhou
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  A transação não pôde ser processada. Tente novamente.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {isFailed ? (
                <Button onClick={handleRetry} className="flex-1 bg-red-600 hover:bg-red-700">
                  Retry
                </Button>
              ) : isSuccess ? (
                <>
                  <Button
                    onClick={() => window.open(`https://solscan.io/tx/${mockTxHash}`, "_blank")}
                    variant="outline"
                    className="flex-1"
                  >
                    View on Solscan
                  </Button>
                  <Button
                    onClick={() => router.push("/history")}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Done
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => router.push("/dashboard")}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              )}

              {/* Botão de teste para simular erro (remover em produção) */}
              {!isSuccess && !isFailed && (
                <Button
                  onClick={simulateError}
                  variant="outline"
                  className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                >
                  Test Error
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
