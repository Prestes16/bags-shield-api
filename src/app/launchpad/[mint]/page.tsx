"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getHistoryEntry } from "@/lib/launchpad/storage";
import type { ShieldProofManifest } from "@/lib/launchpad/types";

export default function TokenPage() {
  const router = useRouter();
  const params = useParams();
  const mint = params.mint as string;
  const [manifest, setManifest] = useState<ShieldProofManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) {
      setError("Invalid mint address");
      setLoading(false);
      return;
    }

    // Try to load from history first
    const entry = getHistoryEntry(mint);
    if (entry) {
      setManifest(entry.manifest);
      setLoading(false);
      return;
    }

    // If not in history, try to get shield score from scan API
    const ctrl = new AbortController();
    const fetchTokenData = async () => {
      try {
        const scanResponse = await fetch(`/api/scan?mint=${encodeURIComponent(mint)}`, {
          method: "GET",
          headers: { "Cache-Control": "no-store" },
          signal: ctrl.signal,
        });

        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          if (scanData.response) {
            const resp = scanData.response;
            const badgeToGrade = (b: string): ShieldProofManifest["grade"] => {
              if (b === "SAFE") return "A";
              if (b === "CAUTION") return "C";
              if (b === "HIGH_RISK") return "E";
              return "E";
            };
            const manifestFromScan: ShieldProofManifest = {
              mint,
              shieldScore: typeof resp.score === "number" ? resp.score : 0,
              grade: badgeToGrade(resp.badge ?? "") ?? "E",
              isSafe: (resp.badge ?? "HIGH_RISK") === "SAFE",
              badges: (resp.reasons ?? []).map((r: { code?: string; title?: string; severity?: string }) => ({
                key: r.code ?? "",
                title: r.title ?? "",
                severity: (r.severity?.toLowerCase() ?? "low") as "low" | "medium" | "high" | "critical",
                impact: "neutral" as const,
                tags: [],
              })),
              summary: resp.summary ?? (resp.reasons?.[0]?.title ?? "Token scan completed"),
              evaluatedAt: new Date().toISOString(),
              requestId: scanData.meta?.requestId || crypto.randomUUID(),
            };
            setManifest(manifestFromScan);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.warn("Failed to fetch token data:", err);
      }

      // If all fails, show error
      setError("Token not found in history and could not be scanned");
      setLoading(false);
    };

    fetchTokenData();
    return () => ctrl.abort();
  }, [mint]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Loading token...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Button onClick={() => router.back()} variant="ghost" className="mb-6">
            ← Back
          </Button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2 text-red-800 dark:text-red-200">
              Token Not Found
            </h2>
            <p className="text-red-600 dark:text-red-300">{error || "Token not found"}</p>
            <Button
              onClick={() => router.push("/launchpad/history")}
              variant="outline"
              className="mt-4"
            >
              View History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-100">
          Token Status
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-2 font-mono text-sm">
          {mint}
        </p>

        {/* Shield Proof Manifest */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            Shield Proof
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Shield Score
              </dt>
              <dd className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {manifest.shieldScore}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Grade
              </dt>
              <dd className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {manifest.grade}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Status
              </dt>
              <dd>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    manifest.isSafe
                      ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                      : "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                  }`}
                >
                  {manifest.isSafe ? "Safe" : "Unsafe"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Evaluated
              </dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100">
                {new Date(manifest.evaluatedAt).toLocaleDateString()}
              </dd>
            </div>
          </div>

          <div className="mb-4">
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              Summary
            </dt>
            <dd className="text-slate-900 dark:text-slate-100">{manifest.summary}</dd>
          </div>

          {manifest.badges.length > 0 && (
            <div>
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                Security Badges
              </dt>
              <dd>
                <div className="flex flex-wrap gap-2">
                  {manifest.badges.map((badge, idx) => (
                    <div
                      key={badge.key || idx}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700"
                    >
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {badge.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {badge.severity} • {badge.impact}
                      </div>
                      {badge.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {badge.tags.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </dd>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button onClick={() => router.push("/launchpad/history")} variant="outline">
            View History
          </Button>
          <Button onClick={() => router.push("/launchpad")} variant="outline">
            Create New Token
          </Button>
        </div>
      </div>
    </div>
  );
}
