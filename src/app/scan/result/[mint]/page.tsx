"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { SwapPanel } from "@/components/solana/SwapPanel";

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
  const q = s.quality;
  const hasDisabled = Array.isArray(q) && q.includes("DISABLED");
  return hasDisabled || (s.error?.toLowerCase?.() ?? "").includes("disabled");
}

function getSourceStatus(s: SourceMetaItem): "OK" | "OFF" | "DOWN" {
  if (isSourceDisabled(s)) return "OFF";
  return s.ok ? "OK" : "DOWN";
}

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  if (price >= 1) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  if (price < 0.0001 && price > 0) return `$${price.toExponential(2)}`;
  return "$0";
}

function formatCompactUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function shortMint(mint: string) {
  return mint.length > 12 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : mint;
}

function severityIcon(sev: string) {
  switch (sev?.toUpperCase()) {
    case "INFO": return { icon: "✓", color: "var(--green)" };
    case "LOW": return { icon: "✓", color: "var(--green)" };
    case "MEDIUM": return { icon: "⚠", color: "var(--amber)" };
    case "HIGH": return { icon: "✗", color: "var(--red)" };
    case "CRITICAL": return { icon: "✗", color: "var(--red)" };
    default: return { icon: "•", color: "var(--txt2)" };
  }
}

function badgeStyle(badge: string): { bg: string; color: string; glow: string } {
  switch (badge) {
    case "SAFE": return { bg: "rgba(0,214,143,0.12)", color: "var(--green)", glow: "0 0 20px rgba(0,214,143,0.3)" };
    case "CAUTION": return { bg: "rgba(255,179,64,0.12)", color: "var(--amber)", glow: "0 0 20px rgba(255,179,64,0.3)" };
    case "HIGH_RISK":
    case "DANGER": return { bg: "rgba(255,59,92,0.12)", color: "var(--red)", glow: "0 0 20px rgba(255,59,92,0.3)" };
    default: return { bg: "var(--surface)", color: "var(--txt2)", glow: "none" };
  }
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 'var(--radius)',
  backdropFilter: 'blur(16px)',
};

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const mint = params.mint as string;
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) { setError("Mint inválido"); setLoading(false); return; }
    const ctrl = new AbortController();
    fetch(`/api/scan?mint=${encodeURIComponent(mint)}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) { setError("Scan falhou"); return; }
        const d = await r.json().catch(() => null) as ScanData | null;
        if (!d?.success || !d?.response) setError("Scan falhou");
        else setData(d);
      })
      .catch((e) => { if ((e as { name?: string })?.name !== "AbortError") setError("Erro ao buscar scan"); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [mint]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--txt2)' }}>
          <span style={{ width: 20, height: 20, border: '2px solid rgba(77,212,255,0.3)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          Carregando resultado…
        </div>
      </div>
    );
  }

  if (error || !data?.response) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <button onClick={() => router.back()} style={{ color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>← Voltar</button>
          <div style={{ ...glass, padding: 24, borderColor: 'rgba(255,59,92,0.3)' }}>
            <h2 style={{ color: 'var(--red)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Erro no scan</h2>
            <p style={{ color: 'var(--txt2)', fontSize: 14 }}>{error || "Não foi possível obter o resultado."}</p>
          </div>
        </div>
      </div>
    );
  }

  const resp = data.response;
  const meta = data.meta;
  const sources = meta?.sources ?? [];
  const token = resp.token;
  const badge = badgeStyle(resp.badge);

  const showSwap = resp.badge !== 'DANGER' && resp.badge !== 'HIGH_RISK' && resp.market.price !== null && (resp.market.liquidity ?? 0) > 500;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 120px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Back */}
        <button onClick={() => router.back()} style={{ color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start' }}>← Voltar</button>

        {/* Token Header */}
        <div style={{ ...glass, padding: 20, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {token?.imageUrl ? (
              <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <Image src={token.imageUrl} alt="" fill style={{ objectFit: 'cover' }} unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--txt3)' }}>?</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>{token?.name || "Token"}</span>
                {token?.symbol && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--surface)', color: 'var(--txt2)' }}>{token.symbol}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--txt3)' }}>{shortMint(resp.mint)}</span>
                <button onClick={() => navigator.clipboard.writeText(mint)} style={{ fontSize: 11, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>Copiar</button>
              </div>
            </div>
          </div>
        </div>

        {/* Score */}
        <div style={{ ...glass, padding: 20, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.05s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--txt)' }}>Resultado</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: badge.color }}>{resp.score}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: badge.bg, color: badge.color, boxShadow: badge.glow }}>
                {resp.badge}
              </span>
            </div>
          </div>
        </div>

        {/* Market Data */}
        <div style={{ ...glass, padding: 20, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.1s' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--txt)', marginBottom: 14 }}>Dados de mercado</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Preço', value: formatPrice(resp.market.price) },
              { label: 'Liquidez', value: formatCompactUsd(resp.market.liquidity) },
              { label: 'Volume 24h', value: formatCompactUsd(resp.market.volume24h) },
              { label: 'Market Cap', value: formatCompactUsd(resp.market.marketCap ?? null) },
            ].map((item) => (
              <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: 'var(--txt)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {/* Solscan link */}
          <a
            href={`https://solscan.io/address/${mint}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}
          >
            Abrir no Solscan ↗
          </a>
        </div>

        {/* Swap Section */}
        {showSwap && resp.badge === 'CAUTION' && (
          <div style={{ ...glass, padding: '12px 16px', borderColor: 'rgba(255,179,64,0.3)', animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.15s' }}>
            <span style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ Token com score médio. Swap por sua conta e risco.</span>
          </div>
        )}

        {showSwap && (
          <div style={{ ...glass, padding: 20, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>Comprar {token?.symbol ?? 'Token'}</span>
              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Beta · via Jupiter</span>
            </div>
            <SwapPanel
              outputMint={mint}
              outputSymbol={token?.symbol}
              outputDecimals={token?.decimals ?? 6}
              defaultAmountSol={0.001}
              compact
            />
          </div>
        )}

        {!showSwap && (resp.badge === 'HIGH_RISK' || resp.badge === 'DANGER') && (
          <div style={{ ...glass, padding: '12px 16px', borderColor: 'rgba(255,59,92,0.3)', animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.15s' }}>
            <span style={{ fontSize: 12, color: 'var(--red)' }}>🚫 Swap desabilitado para tokens de alto risco</span>
          </div>
        )}

        {/* Reasons / Checks */}
        {resp.reasons.length > 0 && (
          <div style={{ ...glass, padding: 20, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.25s' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--txt)', marginBottom: 12 }}>Verificações</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resp.reasons.map((r, i) => {
                const s = severityIcon(r.severity);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                    <span style={{ color: s.color, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500 }}>{r.title}</div>
                      {r.detail && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{r.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div style={{ ...glass, padding: 20, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.3s' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--txt)', marginBottom: 12 }}>Fontes</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sources.map((s) => {
                const st = getSourceStatus(s);
                const pillColor = st === "OK" ? 'var(--green)' : st === "OFF" ? 'var(--txt3)' : 'var(--red)';
                return (
                  <span key={s.name} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${pillColor}33`, background: `${pillColor}11`, color: pillColor, fontWeight: 600, textTransform: 'capitalize' }}>
                    {s.name} {st === "OK" ? "✓" : st === "OFF" ? "—" : "✗"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <details style={{ ...glass, borderRadius: 'var(--radius)', animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0.35s' }}>
          <summary style={{ padding: '12px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--txt3)' }}>Detalhes técnicos</summary>
          <div style={{ padding: '0 16px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--txt3)' }}>
            <p>requestId: {meta?.requestId ?? "—"}</p>
            <p>mint: {resp.mint}</p>
          </div>
        </details>
      </div>
    </div>
  );
}
