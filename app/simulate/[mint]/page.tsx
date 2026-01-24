"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function SimulateMintPage() {
  const params = useParams();
  const router = useRouter();
  const mint = params.mint as string;
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!mint) {
      router.push("/simulate");
    }
  }, [mint, router]);

  const handleSimulate = async () => {
    if (!mint?.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: mint.trim(),
          action,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: "Failed to simulate" });
    } finally {
      setLoading(false);
    }
  };

  if (!mint) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <Button onClick={() => router.back()} variant="ghost" className="mb-6">
          ← Voltar
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
            Simular Trade
          </h1>

          {/* Mint Address (read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Token Mint Address
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600">
              <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
                {mint}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Ação
              </label>
              <div className="flex gap-2">
                <Button
                  variant={action === "buy" ? "default" : "outline"}
                  onClick={() => setAction("buy")}
                >
                  Comprar (BUY)
                </Button>
                <Button
                  variant={action === "sell" ? "default" : "outline"}
                  onClick={() => setAction("sell")}
                >
                  Vender (SELL)
                </Button>
              </div>
            </div>

            <Button onClick={handleSimulate} disabled={loading || !mint.trim()} className="w-full">
              {loading ? "Simulando..." : "Executar Simulação"}
            </Button>

            {result && (
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">
                  Resultado da Simulação
                </h3>
                <pre className="text-sm text-slate-900 dark:text-slate-100 overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
