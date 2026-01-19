"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const mint = params.mint as string;
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mint) {
      router.push("/scan");
      return;
    }

    // Buscar resultado do scan (pode vir da API ou do estado)
    const fetchResult = async () => {
      try {
        // Simulação - substitua pela chamada real à API
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        setResult({
          success: true,
          mint,
          shieldScore: 85,
          grade: "B",
          isSafe: true,
          warnings: [],
          badges: [
            { id: "tx_format", severity: "low", label: "Transaction format OK" },
            { id: "precheck", severity: "low", label: "Pre-check passed" },
          ],
        });
      } catch (error) {
        setResult({ success: false, error: "Failed to load result" });
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [mint, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!result || !result.success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {result?.error || "Failed to load scan result"}
          </p>
          <Button onClick={() => router.push("/scan")}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            Scan Result
          </h1>

          {/* Score Display */}
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-blue-500 mb-2">
              {result.grade} {result.shieldScore}
            </div>
            <p className="text-slate-600 dark:text-slate-400">Shield Score</p>
          </div>

          {/* Mint Address */}
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Mint Address</p>
            <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
              {result.mint}
            </p>
          </div>

          {/* Badges */}
          {result.badges && result.badges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Risk Indicators
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.badges.map((badge: any) => (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-lg border ${
                      badge.severity === "low"
                        ? "bg-green-50 dark:bg-green-900/20 border-green-300"
                        : badge.severity === "medium"
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300"
                        : "bg-red-50 dark:bg-red-900/20 border-red-300"
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={() => router.push("/scan")} variant="outline" className="flex-1">
              New Scan
            </Button>
            <Button onClick={() => router.push("/")} className="flex-1">
              Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
