"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ScanLoadingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mint = searchParams.get("mint");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) {
      router.push("/scan");
      return;
    }

    // Simular chamada à API
    const scanToken = async () => {
      try {
        // Aqui você pode chamar a API real quando estiver pronta
        // const response = await fetch(`/api/scan?mint=${mint}`);
        // const data = await response.json();
        
        // Simulação por enquanto
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        setResult({
          success: true,
          mint,
          score: 85,
          grade: "B",
        });
      } catch (err) {
        setError("Failed to scan token");
      } finally {
        setLoading(false);
      }
    };

    scanToken();
  }, [mint, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Scanning token...</p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">{mint}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <Button onClick={() => router.push("/scan")}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Scan Result
        </h2>
        {result && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Mint Address</p>
              <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
                {result.mint}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Shield Score</p>
              <p className="text-3xl font-bold text-blue-500">
                {result.grade} {result.score}
              </p>
            </div>
            <Button onClick={() => router.push("/")} className="w-full">
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
