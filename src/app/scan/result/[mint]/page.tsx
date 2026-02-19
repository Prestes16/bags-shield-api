"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface SourceMetaItem {
  name: string;
  ok: boolean;
  quality?: string[];
  error?: string;
  latencyMs?: number;
  fetchedAt?: string;
}

interface ScanResponse {
  mint: string;
  token?: { name?: string; symbol?: string; imageUrl?: string; decimals?: number; source: string };
  score: number;
  badge: string;
  confidence: number;
  reasons: Array<{ code: string; title: string; detail: string; severity: string; evidence?: Record<string, unknown> }>;
  signals: { data_conflict?: boolean; sourcesOk?: number; sourcesTotal?: number; mintActive?: boolean };
  market: {
    price: number | null;
    liquidity: number | null;
    volume24h: number | null;
    marketCap?: number | null;
    sourcesUsed?: string[];
    liquidityEvidence?: { dexId: string; pairAddress: string; liquidityUsd: number };
  };
  ts?: string;
}

interface ScanData {
  success: boolean;
  response?: ScanResponse;
  meta?: {
    requestId?: string;
    sources?: SourceMetaItem[];
    coverage?: { sourcesOk: number; sourcesTotal: number; degraded: boolean };
    timingMs?: { total?: number; fetch?: number; compute?: number };
  };
}

function isSourceDisabled(s: SourceMetaItem): boolean {
  return s.quality?.includes("DISABLED") === true || (s.error?.toLowerCase?.() ?? "").includes("disabled");
}

function getSourceStatus(s: SourceMetaItem): "OK" | "OFF" | "DOWN" {
  if (isSourceDisabled(s)) return "OFF";
  return s.ok ? "OK" : "DOWN";
}

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  if (price >= 1) return price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (price >= 0.0001) return price.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  if (price < 0.0001 && price > 0) return price.toExponential(2);
  if (price === 0) return "0";
  return "—";
}

function formatCompactUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function reasonTitlePt(code: string, title: string, detail: string): string {
  const map: Record<string, string> = {
    DATA_CONFLICT: "Preço ou volume diverge significativamente entre fontes.",
    LOW_LIQUIDITY: "Liquidez baixa.",
    DEGRADED_SOURCES: "Dados incompletos.",
  };
  if (code === "LOW_LIQUIDITY" && detail) {
    const match = detail.match(/\$[\d,\.]+/);
    return match ? `Liquidez é ${match[0]}.` : "Liquidez é $X.";
  }
  if (code === "DEGRADED_SOURCES" && detail) {
    const match = detail.match(/(\d+)\/(\d+)/);
    return match ? `${match[1]}/${match[2]} fontes habilitadas disponíveis.` : "Dados incompletos.";
  }
  return map[code] ?? title;
}

function shortMint(mint: string) {
  return mint.length > 12 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : mint;
}

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const mint = params.mint as string;
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) {
      setError("Mint inválido");
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/scan?mint=${encodeURIComponent(mint)}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: ScanData) => {
        if (!d.success || !d.response) setError("Scan falhou");
        else setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Erro ao buscar scan");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [mint]);

  const copyMint = () => {
    if (mint) navigator.clipboard.writeText(mint);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">Carregando resultado…</p>
      </div>
    );
  }

  if (error || !data?.response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-2xl mx-auto">
          <Button onClick={() => router.back()} variant="outline" className="mb-6">
            ← Voltar
          </Button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Erro no scan</h2>
            <p className="text-red-600 dark:text-red-300">{error || "Não foi possível obter o resultado."}</p>
          </div>
        </div>
      </div>
    );
  }

  const resp = data.response;
  const meta = data.meta;
  const coverage = meta?.coverage;
  const sources = meta?.sources ?? [];
  const degraded = coverage?.degraded ?? false;
  const token = resp.token;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button onClick={() => router.back()} variant="outline" size="sm">
          ← Voltar
        </Button>

        {/* Token Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          {token && (token.name || token.symbol) ? (
            <div className="flex items-center gap-4">
              {token.imageUrl && (
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                  <Image
                    src={token.imageUrl}
                    alt={token.name || token.symbol || ""}
                    fill
                    className="object-cover"
                    unoptimized
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg text-slate-900 dark:text-slate-100">{token.name || "—"}</span>
                  {token.symbol && (
                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium">
                      {token.symbol}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{shortMint(resp.mint)}</span>
                  <button
                    type="button"
                    onClick={copyMint}
                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                    aria-label="Copiar mint"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">{resp.mint}</p>
              <button
                type="button"
                onClick={copyMint}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-1"
                aria-label="Copiar mint"
              >
                Copiar
              </button>
            </div>
          )}
        </div>

        {/* Score Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Resultado da Análise</h2>
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-600 dark:text-slate-400">Score</span>
            <span
              className={`text-3xl font-bold ${
                resp.badge === "SAFE"
                  ? "text-green-600"
                  : resp.badge === "CAUTION"
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {resp.badge} {resp.score}
            </span>
          </div>
          {resp.reasons.filter((r) => !(r.code === "DEGRADED_SOURCES" && !degraded)).length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Verificações</p>
              {resp.reasons
                .filter((r) => !(r.code === "DEGRADED_SOURCES" && !degraded))
                .map((r, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50"
                >
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {r.code === "DEGRADED_SOURCES" && coverage
                      ? `${coverage.sourcesOk}/${coverage.sourcesTotal} fontes habilitadas disponíveis.`
                      : reasonTitlePt(r.code, r.title, r.detail)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incomplete Data - só quando degraded */}
        {degraded && coverage && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Dados incompletos</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {coverage.sourcesOk}/{coverage.sourcesTotal} fontes habilitadas disponíveis.
            </p>
          </div>
        )}

        {/* Dados de mercado */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Dados de mercado</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Preço</dt>
              <dd className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {formatPrice(resp.market.price)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Liquidez</dt>
              <dd className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {formatCompactUsd(resp.market.liquidity)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Volume 24h</dt>
              <dd className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {formatCompactUsd(resp.market.volume24h)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Market Cap</dt>
              <dd className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {formatCompactUsd(resp.market.marketCap ?? null)}
              </dd>
            </div>
          </div>
          {resp.market.liquidityEvidence && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Pool principal</p>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {resp.market.liquidityEvidence.dexId} • {shortMint(resp.market.liquidityEvidence.pairAddress)} •{" "}
                {formatCompactUsd(resp.market.liquidityEvidence.liquidityUsd)}
              </p>
            </div>
          )}
        </div>

        {/* Fontes (sources) */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Fontes</h2>
          <div className="grid grid-cols-2 gap-3">
            {sources.map((s) => {
              const status = getSourceStatus(s);
              const label = status === "OK" ? "OK" : status === "OFF" ? "Desativado" : "Indisponível";
              const bgMap = {
                OK: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
                OFF: "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600",
                DOWN: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
              };
              return (
                <div
                  key={s.name}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">{s.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${bgMap[status]}`}>
                      {label}
                    </span>
                  </div>
                  {status === "OFF" && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Desativado</p>}
                  {status === "DOWN" && s.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">{s.error}</p>
                  )}
                  {s.latencyMs != null && status === "OK" && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.latencyMs}ms</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes técnicos (colapsável) */}
        <details className="bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <summary className="p-3 cursor-pointer text-sm text-slate-600 dark:text-slate-400">
            Detalhes técnicos
          </summary>
          <div className="p-3 pt-0 text-xs font-mono text-slate-500 dark:text-slate-500 break-all">
            requestId: {meta?.requestId ?? "—"}
          </div>
        </details>
      </div>
    </div>
  );
}
