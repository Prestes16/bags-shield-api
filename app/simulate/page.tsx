"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SimulatePage() {
  const router = useRouter();
  const [mint, setMint] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSimulate = async () => {
    if (!mint.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint,
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <Button onClick={() => router.back()} variant="ghost" className="mb-6">
          ← Back
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
            Simulate Swap
          </h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Token Mint Address
              </label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Enter token mint address..."
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Action
              </label>
              <div className="flex gap-2">
                <Button
                  variant={action === "buy" ? "default" : "outline"}
                  onClick={() => setAction("buy")}
                >
                  Buy
                </Button>
                <Button
                  variant={action === "sell" ? "default" : "outline"}
                  onClick={() => setAction("sell")}
                >
                  Sell
                </Button>
              </div>
            </div>

            <Button onClick={handleSimulate} disabled={loading || !mint.trim()}>
              {loading ? "Simulating..." : "Run Simulation"}
            </Button>

            {result && (
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
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
