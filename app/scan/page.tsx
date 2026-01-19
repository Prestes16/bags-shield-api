"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function ScanPage() {
  const router = useRouter();
  const [rawTransaction, setRawTransaction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async () => {
    if (!rawTransaction.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawTransaction,
          network: "mainnet-beta",
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: "Failed to scan transaction" });
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
            Scan Transaction
          </h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Raw Transaction (Base64)
              </label>
              <textarea
                value={rawTransaction}
                onChange={(e) => setRawTransaction(e.target.value)}
                placeholder="Paste raw transaction (base64)..."
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                rows={6}
              />
            </div>

            <Button onClick={handleScan} disabled={loading || !rawTransaction.trim()}>
              {loading ? "Scanning..." : "Run Scan"}
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
