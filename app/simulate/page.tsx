"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function SimulatePage() {
  const router = useRouter();
  const [mint, setMint] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [estimatedReceive, setEstimatedReceive] = useState<number>(0);

  // Mock price para cálculo (em produção viria da API)
  const mockPrice = 0.05; // Exemplo: $0.05 por token

  // Live preview: atualiza estimatedReceive em tempo real
  useEffect(() => {
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      setEstimatedReceive(0);
      return;
    }

    // Fórmula: estimatedReceive = amount * mockPrice * (1 - slippage/100)
    const receive = amountNum * mockPrice * (1 - slippage / 100);
    setEstimatedReceive(receive);
  }, [amount, slippage, tradeType]);

  // Botões de atalho: preenchem o input amount
  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  // Ação de simular
  const handleSimulate = async () => {
    if (!mint.trim() || !amount || parseFloat(amount) <= 0) return;

    setIsSimulating(true);

    // Calcular price impact mockado (em produção viria da API)
    const amountNum = parseFloat(amount) || 0;
    const mockPriceImpact = amountNum > 1000 ? 6.5 : amountNum > 500 ? 3.2 : 1.8;

    // Simulação com delay de 2 segundos
    setTimeout(() => {
      // Determinar status baseado em price impact
      const status = mockPriceImpact > 5 ? "failed" : "success";

      // Redirecionar para /simulate/result com dados via query params
      const params = new URLSearchParams({
        mint: mint.trim(),
        tradeType,
        amount,
        slippage: slippage.toString(),
        estimatedReceive: estimatedReceive.toFixed(6),
        priceImpact: mockPriceImpact.toFixed(2),
        status,
      });

      router.push(`/simulate/result?${params.toString()}`);
    }, 2000);
  };

  // Classes de cor baseadas no tradeType
  const getTradeTypeColor = () => {
    return tradeType === "buy"
      ? "text-cyan-500 border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
      : "text-red-500 border-red-500 bg-red-50 dark:bg-red-900/20";
  };

  const getTradeTypeButtonColor = (type: "buy" | "sell") => {
    if (tradeType === type) {
      return type === "buy"
        ? "bg-cyan-500 hover:bg-cyan-600 text-white"
        : "bg-red-500 hover:bg-red-600 text-white";
    }
    return "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <Button onClick={() => router.back()} variant="ghost" className="mb-6">
          ← Voltar
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
            Simular Trade
          </h1>

          <div className="space-y-6">
            {/* Token Mint Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Token Mint Address
              </label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Digite o endereço do token..."
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Trade Type (Buy/Sell) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tipo de Trade
              </label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setTradeType("buy")}
                  className={`flex-1 transition-colors ${getTradeTypeButtonColor("buy")}`}
                >
                  Comprar (BUY)
                </Button>
                <Button
                  onClick={() => setTradeType("sell")}
                  className={`flex-1 transition-colors ${getTradeTypeButtonColor("sell")}`}
                >
                  Vender (SELL)
                </Button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Quantidade
              </label>
              <div className="flex gap-2 mb-2">
                <Button
                  onClick={() => handleQuickAmount(0.1)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  0.1
                </Button>
                <Button
                  onClick={() => handleQuickAmount(0.5)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  0.5
                </Button>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={`w-full p-3 border-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:outline-none transition-colors ${getTradeTypeColor()}`}
              />
            </div>

            {/* Slippage */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Slippage: {slippage}%
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>0.1%</span>
                <span>5%</span>
              </div>
            </div>

            {/* Live Preview */}
            {amount && parseFloat(amount) > 0 && (
              <div className={`p-4 rounded-lg border-2 ${getTradeTypeColor()}`}>
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {tradeType === "buy" ? "Você receberá:" : "Você receberá:"}
                </div>
                <div className="text-2xl font-bold">
                  {estimatedReceive.toFixed(6)} SOL
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  (estimado, considerando slippage de {slippage}%)
                </div>
              </div>
            )}

            {/* Run Simulation Button */}
            <Button
              onClick={handleSimulate}
              disabled={isSimulating || !mint.trim() || !amount || parseFloat(amount) <= 0}
              className="w-full"
              size="lg"
            >
              {isSimulating ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
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
                  Simulando...
                </span>
              ) : (
                "Executar Simulação"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
