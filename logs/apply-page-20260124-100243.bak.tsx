"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { LoadingOverlay } from "@/components/states/LoadingOverlay";
import { SkeletonFees } from "@/components/states/SkeletonFees";

interface TransactionDetails {
  amount: number;
  token: string;
  fees: number;
}

type RiskLevel = "LOW" | "HIGH";

export default function ApplyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("LOW");
  const [isCalculatingFees, setIsCalculatingFees] = useState(true);
  const [isWaitingWallet, setIsWaitingWallet] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [networkFees, setNetworkFees] = useState<number>(0);

  useEffect(() => {
    // Simular cálculo de fees da rede
    const calculateFees = async () => {
      setIsCalculatingFees(true);
      
      // Simular delay de API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Mock fees (em produção viria da API)
      const mockFees = 0.000005; // ~5000 lamports
      setNetworkFees(mockFees);
      
      // Pegar dados dos query params ou usar mock
      const amount = parseFloat(searchParams.get("amount") || "1000");
      const token = searchParams.get("token") || searchParams.get("mint") || "SOL";
      const priceImpact = parseFloat(searchParams.get("priceImpact") || "0");
      
      // Determinar risk level baseado em price impact
      const risk: RiskLevel = priceImpact > 5 ? "HIGH" : "LOW";
      
      setTransactionDetails({
        amount,
        token,
        fees: mockFees,
      });
      setRiskLevel(risk);
      setIsCalculatingFees(false);
    };

    calculateFees();
  }, [searchParams]);

  // Simular assinatura da carteira
  const handleConfirmAndSign = async () => {
    if (riskLevel === "HIGH" && !riskAcknowledged) {
      return; // Não permite se não tiver confirmado o risco
    }

    setIsWaitingWallet(true);

    try {
      // Simular chamada de wallet.signTransaction()
      // Em produção, isso seria algo como:
      // const signedTx = await wallet.signTransaction(transaction);
      
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Após assinatura, redirecionar para /transaction/progress
      router.push("/transaction/progress");
    } catch (error) {
      console.error("Error signing transaction:", error);
      setIsWaitingWallet(false);
      // Em produção, mostrar erro ao usuário
    }
  };

  const canProceed = riskLevel === "LOW" || (riskLevel === "HIGH" && riskAcknowledged);

  if (isCalculatingFees || !transactionDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
              Aplicar Transação
            </h1>
            <SkeletonFees />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      {isWaitingWallet && <LoadingOverlay />}

      <div className="max-w-2xl mx-auto">
        <Button onClick={() => router.push("/dashboard")} variant="ghost" className="mb-6">
          ← Voltar ao Dashboard
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
            Confirmar Transação
          </h1>

          <div className="space-y-6">
            {/* Risk Level Badge */}
            {riskLevel === "HIGH" && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-6 h-6 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="font-bold text-red-600 dark:text-red-400">Risco Alto</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Esta transação apresenta um risco elevado. Por favor, revise cuidadosamente antes de confirmar.
                </p>
              </div>
            )}

            {/* Transaction Details */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Quantidade
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {transactionDetails.amount} {transactionDetails.token}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Taxas de Rede (Network Fees)
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {networkFees.toFixed(9)} SOL
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Taxas calculadas pela rede Solana
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Total
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {(transactionDetails.amount + networkFees).toFixed(6)} SOL
                </div>
              </div>
            </div>

            {/* Risk Acknowledgment Checkbox (apenas se HIGH) */}
            {riskLevel === "HIGH" && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-300 dark:border-red-700 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskAcknowledged}
                    onChange={(e) => setRiskAcknowledged(e.target.checked)}
                    className="mt-1 w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-red-900 dark:text-red-200">
                    Estou ciente do risco alto e desejo prosseguir com esta transação.
                  </span>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="flex-1"
                disabled={isWaitingWallet}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmAndSign}
                disabled={!canProceed || isWaitingWallet}
                className={`flex-1 ${
                  riskLevel === "HIGH"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } ${!canProceed ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isWaitingWallet ? "Assinando..." : "Confirm & Sign"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
