"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { SkeletonResult } from "@/components/states/SkeletonResult";

interface SimulationResult {
  status: "success" | "failed";
  mint: string;
  tradeType: "buy" | "sell";
  amount: number;
  estimatedReceive: number;
  priceImpact?: number;
  slippage: number;
  errorReason?: string;
  // Dados adicionais que podem vir da API
  [key: string]: any;
}

export default function SimulateResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento de dados (pode vir da API ou query params)
    const loadSimulationData = async () => {
      setIsLoading(true);

      // Simular delay de API
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Pegar dados dos query params
      const mint = searchParams.get("mint");
      const tradeType = searchParams.get("tradeType") as "buy" | "sell" | null;
      const amount = searchParams.get("amount");
      const slippage = searchParams.get("slippage");
      const estimatedReceive = searchParams.get("estimatedReceive");
      const status = searchParams.get("status") as "success" | "failed" | null;

      // Se não tem dados mínimos, simular um resultado
      if (!mint || !tradeType || !amount) {
        // Mock data para demonstração
        setSimulation({
          status: status || "success",
          mint: mint || "8xF...k3a",
          tradeType: tradeType || "buy",
          amount: parseFloat(amount || "1000"),
          estimatedReceive: parseFloat(estimatedReceive || "50"),
          priceImpact: 2.5, // Mock price impact
          slippage: parseFloat(slippage || "1"),
        });
      } else {
        // Determinar status baseado em price impact ou outros fatores
        const priceImpact = parseFloat(searchParams.get("priceImpact") || "0");
        const finalStatus: "success" | "failed" =
          status ||
          (priceImpact > 5
            ? "failed"
            : priceImpact > 2
            ? "success"
            : "success");

        setSimulation({
          status: finalStatus,
          mint,
          tradeType,
          amount: parseFloat(amount),
          estimatedReceive: parseFloat(estimatedReceive || "0"),
          priceImpact,
          slippage: parseFloat(slippage || "1"),
          errorReason:
            finalStatus === "failed"
              ? priceImpact > 5
                ? "Price Impact too High"
                : "Simulation failed"
              : undefined,
        });
      }

      setIsLoading(false);
    };

    loadSimulationData();
  }, [searchParams]);

  // Formatação de números grandes (ex: 950000 -> 950k)
  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + "M";
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + "k";
    }
    return num.toFixed(2);
  };

  // Cor do Price Impact baseado no valor
  const getPriceImpactColor = (priceImpact: number): string => {
    if (priceImpact > 5) {
      return "text-red-600 dark:text-red-400 font-bold";
    }
    if (priceImpact > 2) {
      return "text-yellow-600 dark:text-yellow-400 font-semibold";
    }
    return "text-green-600 dark:text-green-400";
  };

  // Loading state com Skeleton
  if (isLoading || !simulation) {
    return <SkeletonResult />;
  }

  const isSuccess = simulation.status === "success";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        <Button onClick={() => router.push("/dashboard")} variant="ghost" className="mb-6">
          ← Voltar ao Dashboard
        </Button>

        {/* Card de Status (Success ou Failed) */}
        <div
          className={`mb-6 rounded-lg border-2 p-6 ${
            isSuccess
              ? "bg-green-50 dark:bg-green-900/20 border-green-500"
              : "bg-red-50 dark:bg-red-900/20 border-red-500"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {isSuccess ? (
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
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
                className="w-8 h-8 text-red-600 dark:text-red-400"
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
            )}
            <div>
              <h2 className="text-2xl font-bold">
                {isSuccess ? "Simulação Aprovada" : "Simulação Falhou"}
              </h2>
              {!isSuccess && simulation.errorReason && (
                <p className="text-sm mt-1 text-red-700 dark:text-red-300">
                  {simulation.errorReason}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
            Detalhes da Simulação
          </h1>

          <div className="space-y-6">
            {/* Trade Type Badge */}
            <div
              className={`p-4 rounded-lg border-2 ${
                simulation.tradeType === "buy"
                  ? "text-cyan-500 border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                  : "text-red-500 border-red-500 bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <div className="text-sm font-medium mb-1">Tipo de Trade</div>
              <div className="text-xl font-bold">
                {simulation.tradeType === "buy" ? "COMPRAR" : "VENDER"}
              </div>
            </div>

            {/* Mint Address */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Token Mint Address
              </div>
              <div className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
                {simulation.mint}
              </div>
            </div>

            {/* Amount */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Quantidade
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatLargeNumber(simulation.amount)} tokens
              </div>
            </div>

            {/* Estimated Receive */}
            <div
              className={`p-4 rounded-lg border-2 ${
                simulation.tradeType === "buy"
                  ? "text-cyan-500 border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                  : "text-red-500 border-red-500 bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <div className="text-sm font-medium mb-1">Você receberá (estimado)</div>
              <div className="text-3xl font-bold">
                {simulation.estimatedReceive.toFixed(6)} SOL
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Slippage: {simulation.slippage}%
              </div>
            </div>

            {/* Price Impact */}
            {simulation.priceImpact !== undefined && (
              <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Price Impact
                </div>
                <div className={`text-2xl font-bold ${getPriceImpactColor(simulation.priceImpact)}`}>
                  {simulation.priceImpact.toFixed(2)}%
                </div>
                {simulation.priceImpact > 5 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ⚠️ Price impact muito alto! Recomendamos ajustar a quantidade.
                  </p>
                )}
                {simulation.priceImpact > 2 && simulation.priceImpact <= 5 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    ⚠️ Price impact moderado. Considere dividir em múltiplas transações.
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => router.push("/apply")}
                disabled={!isSuccess}
                className={`flex-1 ${
                  !isSuccess
                    ? "opacity-50 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isSuccess ? "Proceed to Apply" : "Cannot Proceed"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
