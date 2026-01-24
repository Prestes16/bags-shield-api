"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loadHistory } from "@/lib/launchpad/storage";
import type { HistoryEntry } from "@/lib/launchpad/storage";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const entries = loadHistory();
    setHistory(entries);
    setLoading(false);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const shortMint = (mint: string) => {
    if (mint.length <= 12) return mint;
    return `${mint.slice(0, 6)}...${mint.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Launch History
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Your token launches and Shield proofs
            </p>
          </div>
          <Button onClick={() => router.push("/launchpad/create")}>
            Create New
          </Button>
        </div>

        {history.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-12 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No launch history yet
            </p>
            <Button onClick={() => router.push("/launchpad/create")}>
              Create Your First Token
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div
                key={entry.mint}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => router.push(`/launchpad/${entry.mint}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {entry.config.token.name} ({entry.config.token.symbol})
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          entry.manifest.isSafe
                            ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                            : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                        }`}
                      >
                        {entry.manifest.isSafe ? "Safe" : "Unsafe"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mb-2">
                      {shortMint(entry.mint)}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <span>
                        Score: <strong>{entry.manifest.shieldScore}/100</strong>
                      </span>
                      <span>
                        Grade: <strong>{entry.manifest.grade}</strong>
                      </span>
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/launchpad/${entry.mint}`);
                    }}
                  >
                    View →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
