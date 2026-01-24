"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { SkeletonList } from "@/components/states/SkeletonList";

type HistoryType = "scan" | "simulate" | "txn";
type FilterType = "all" | HistoryType;
type HistoryStatus = "success" | "failed" | "pending";

interface HistoryItem {
  id: string;
  type: HistoryType;
  tokenSymbol: string;
  mint: string;
  date: Date;
  status: HistoryStatus;
  score?: number;
  txHash?: string;
}

// Mock data inteligente
const mockHistoryData: HistoryItem[] = [
  {
    id: "1",
    type: "scan",
    tokenSymbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    date: new Date(Date.now() - 1000 * 60 * 30), // 30 min atrás
    status: "success",
    score: 85,
  },
  {
    id: "2",
    type: "simulate",
    tokenSymbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h atrás
    status: "failed",
    score: 45,
  },
  {
    id: "3",
    type: "txn",
    tokenSymbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5h atrás
    status: "success",
    txHash: "5KJp7mN9qR2sT8vW1xY3zA6bC4dE7fG0hI2jK5lM8nO1pQ4rS6tU9vW2xY5z",
  },
  {
    id: "4",
    type: "scan",
    tokenSymbol: "POPCAT",
    mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 dia atrás
    status: "success",
    score: 92,
  },
  {
    id: "5",
    type: "simulate",
    tokenSymbol: "MYRO",
    mint: "ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs",
    date: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 dias atrás
    status: "success",
    score: 78,
  },
];

export default function HistoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [historyData] = useState<HistoryItem[]>(mockHistoryData);

  // Simular carregamento inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Filtrar dados baseado no filtro e busca
  const filteredData = useMemo(() => {
    let filtered = historyData;

    // Filtro por tipo
    if (filter !== "all") {
      filtered = filtered.filter((item) => item.type === filter);
    }

    // Filtro por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.tokenSymbol.toLowerCase().includes(query) ||
          item.mint.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [historyData, filter, searchQuery]);

  // Formatar data
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  // Navegação baseada no tipo
  const handleItemClick = (item: HistoryItem) => {
    if (item.type === "scan") {
      router.push(`/scan/result/${item.mint}`);
    } else if (item.type === "simulate") {
      router.push(`/simulate/result?mint=${item.mint}&status=success`);
    } else if (item.type === "txn" && item.txHash) {
      window.open(`https://solscan.io/tx/${item.txHash}`, "_blank");
    }
  };

  // Obter cor do status
  const getStatusColor = (status: HistoryStatus): string => {
    switch (status) {
      case "success":
        return "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-300";
      case "failed":
        return "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-300";
      case "pending":
        return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-300";
      default:
        return "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300";
    }
  };

  // Obter label do tipo
  const getTypeLabel = (type: HistoryType): string => {
    switch (type) {
      case "scan":
        return "Scan";
      case "simulate":
        return "Simulação";
      case "txn":
        return "Transação";
      default:
        return type;
    }
  };

  // Empty State Component
  const EmptyState = () => (
    <div className="text-center py-12">
      <svg
        className="w-16 h-16 mx-auto mb-4 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="text-slate-600 dark:text-slate-400 font-medium mb-2">
        Nenhum item encontrado
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-500">
        {searchQuery
          ? "Tente buscar com outros termos"
          : "Seu histórico aparecerá aqui"}
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
              Histórico de Transações
            </h1>
            <SkeletonList />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <Button onClick={() => router.push("/dashboard")} variant="ghost" className="mb-6">
          ← Voltar ao Dashboard
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
            Histórico de Transações
          </h1>

          {/* Busca */}
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por token ou mint address..."
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtros (Tabs) */}
          <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
            {(["all", "scan", "simulate", "txn"] as FilterType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                  filter === tab
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {tab === "all"
                  ? "Todos"
                  : tab === "scan"
                  ? "Scans"
                  : tab === "simulate"
                  ? "Simulações"
                  : "Transações"}
              </button>
            ))}
          </div>

          {/* Lista de Histórico */}
          {filteredData.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {filteredData.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.tokenSymbol}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                            item.status
                          )}`}
                        >
                          {getTypeLabel(item.type)}
                        </span>
                        {item.status === "success" && item.score !== undefined && (
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            Score: {item.score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                        {item.mint.slice(0, 8)}...{item.mint.slice(-8)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(item.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "success" ? (
                        <svg
                          className="w-5 h-5 text-green-600"
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
                      ) : item.status === "failed" ? (
                        <svg
                          className="w-5 h-5 text-red-600"
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
                      ) : (
                        <svg
                          className="w-5 h-5 text-yellow-600 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
