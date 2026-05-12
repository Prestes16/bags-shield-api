'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';

type QuoteResponse = any;

type SwapApiResp = {
  success: boolean;
  response?: {
    swapTransaction: string;
    lastValidBlockHeight?: number;
  };
  warning?: { code: string; message: string };
  error?: any;
  meta?: { requestId?: string };
};

interface SwapPanelProps {
  inputMint?: string;
  inputSymbol?: string;
  inputDecimals?: number;
  outputMint?: string;
  outputSymbol?: string;
  outputDecimals?: number;
  defaultAmountSol?: number;
  compact?: boolean;
}

function base64ToUint8Array(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function SwapPanel({
  inputMint = 'So11111111111111111111111111111111111111112',
  inputSymbol = 'SOL',
  inputDecimals = 9,
  outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  outputSymbol = 'USDC',
  outputDecimals = 6,
  defaultAmountSol = 0.001,
  compact = false,
}: SwapPanelProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const runningRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const [amountIn, setAmountIn] = useState(defaultAmountSol);
  const [slippageBps, setSlippageBps] = useState(50);

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [warning, setWarning] = useState<{ code: string; message: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'quoting' | 'quoted' | 'swapping' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [txSig, setTxSig] = useState<string | null>(null);

  const base = useMemo(() => process.env.NEXT_PUBLIC_API_BASE ?? '', []);
  const api = (p: string) => `${base}${p}`;

  const inAmountUnits = Math.max(1, Math.floor(amountIn * Math.pow(10, inputDecimals))).toString();

  async function guardrails() {
    if (!connected || !publicKey || !signTransaction) {
      setStatusMsg('Conecte a wallet primeiro.');
      setStatus('error');
      return false;
    }
    try {
      const bal = await connection.getBalance(publicKey, 'processed');
      if (bal < 2_000_000) {
        setStatusMsg(`Saldo insuficiente (${(bal / 1e9).toFixed(6)} SOL)`);
        setStatus('error');
        return false;
      }
    } catch { /* não bloqueia */ }
    return true;
  }

  async function doQuote() {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setWarning(null);
    setStatus('quoting');
    setStatusMsg('');
    setTxSig(null);

    try {
      const ok = await guardrails();
      if (!ok) return;

      const qUrl = api(
        `/api/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inAmountUnits}&slippageBps=${slippageBps}`
      );
      const r = await fetch(qUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error?.message ?? `Quote falhou`);

      setQuote(j.response);
      setStatus('quoted');
    } catch (e: any) {
      setStatusMsg(e?.message ?? String(e));
      setStatus('error');
      setQuote(null);
    } finally {
      setBusy(false);
      runningRef.current = false;
    }
  }

  async function doSwap() {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setWarning(null);
    setStatus('swapping');
    setStatusMsg('Montando transação…');

    try {
      const ok = await guardrails();
      if (!ok) return;
      if (!quote) { setStatusMsg('Obtenha o quote primeiro.'); setStatus('error'); return; }

      const s = await fetch(api('/api/swap'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          userPublicKey: publicKey!.toBase58(),
          quoteResponse: quote,
          prioritizationFeeLamports: 'auto',
          dynamicComputeUnitLimit: true,
          wrapAndUnwrapSol: true,
        }),
      });

      const sj = (await s.json()) as SwapApiResp;
      if (!s.ok || !sj?.success || !sj.response?.swapTransaction) {
        throw new Error(sj?.error?.message ?? `Swap build falhou`);
      }
      if (sj.warning) setWarning(sj.warning);

      setStatusMsg('Assinando…');
      const bytes = base64ToUint8Array(sj.response.swapTransaction);
      const tx = VersionedTransaction.deserialize(bytes);
      const signed = await signTransaction!(tx);

      setStatusMsg('Enviando…');
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      });

      setStatusMsg('Confirmando…');
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: sj.response.lastValidBlockHeight ?? latest.lastValidBlockHeight,
        },
        'confirmed'
      );

      setTxSig(sig);
      setStatus('success');
      setStatusMsg('');
    } catch (e: any) {
      setStatusMsg(e?.message ?? String(e));
      setStatus('error');
    } finally {
      setBusy(false);
      runningRef.current = false;
    }
  }

  function reset() {
    setQuote(null);
    setStatus('idle');
    setStatusMsg('');
    setTxSig(null);
    setWarning(null);
  }

  const outAmount = quote?.outAmount
    ? (Number(quote.outAmount) / Math.pow(10, outputDecimals)).toFixed(Math.min(outputDecimals, 6))
    : null;

  const routeLabel = quote?.routePlan?.[0]?.swapInfo?.label ?? null;
  const priceImpact = quote?.priceImpactPct ? Number(quote.priceImpactPct) : null;

  const impactColor = priceImpact === null
    ? 'var(--txt2)'
    : priceImpact < 1 ? 'var(--green)' : priceImpact < 3 ? 'var(--amber)' : 'var(--red)';

  const slippagePresets = [50, 100, 200];

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 'var(--radius)',
    backdropFilter: 'blur(16px)',
    padding: compact ? '16px' : '24px',
    animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
  };

  const primaryBtn: React.CSSProperties = {
    background: 'linear-gradient(135deg,#4DD4FF 0%,#9945FF 100%)',
    color: '#080811',
    fontWeight: 700,
    borderRadius: 12,
    padding: '12px 24px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    width: '100%',
    opacity: busy ? 0.6 : 1,
    pointerEvents: busy ? 'none' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
          {inputSymbol} → {outputSymbol}
        </span>
        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>⇄ Jupiter</span>
      </div>

      {/* Warning */}
      {warning && (
        <div style={{ background: 'rgba(255,179,64,0.1)', border: '1px solid rgba(255,179,64,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--amber)' }}>
          <strong>{warning.code}</strong>: {warning.message}
        </div>
      )}

      {/* Amount Input */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Você paga ({inputSymbol})</label>
        <input
          type="number"
          inputMode="decimal"
          value={String(amountIn)}
          onChange={(e) => { setAmountIn(Number(e.target.value || '0')); setQuote(null); setStatus('idle'); }}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 18, fontWeight: 600, color: 'var(--txt)', fontFamily: 'monospace', outline: 'none' }}
        />
      </div>

      {/* Slippage */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--txt2)', display: 'block', marginBottom: 6 }}>Slippage</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {slippagePresets.map((v) => (
            <button
              key={v}
              onClick={() => setSlippageBps(v)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 8,
                border: slippageBps === v ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.1)',
                background: slippageBps === v ? 'rgba(77,212,255,0.1)' : 'transparent',
                color: slippageBps === v ? 'var(--cyan)' : 'var(--txt2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {v / 100}%
            </button>
          ))}
          <input
            type="number"
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value || '50'))}
            style={{ width: 60, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 12, color: 'var(--txt)', textAlign: 'center', outline: 'none' }}
          />
        </div>
      </div>

      {/* Info row */}
      {quote && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--txt3)' }}>Est. saída</span>
            <span style={{ color: 'var(--txt)', fontFamily: 'monospace', fontWeight: 600 }}>{outAmount} {outputSymbol}</span>
          </div>
          {routeLabel && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--txt3)' }}>Rota</span>
              <span style={{ color: 'var(--txt)' }}>{routeLabel}</span>
            </div>
          )}
          {priceImpact !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--txt3)' }}>Price Impact</span>
              <span style={{ color: impactColor, fontWeight: 600 }}>{priceImpact.toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      {status === 'idle' || status === 'error' ? (
        <button onClick={doQuote} style={primaryBtn} disabled={busy}>
          {busy && <span style={{ width: 16, height: 16, border: '2px solid rgba(8,8,17,0.3)', borderTopColor: '#080811', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
          {busy ? 'Obtendo Quote…' : 'Obter Quote'}
        </button>
      ) : status === 'quoted' ? (
        <button onClick={doSwap} style={primaryBtn} disabled={busy}>
          {busy && <span style={{ width: 16, height: 16, border: '2px solid rgba(8,8,17,0.3)', borderTopColor: '#080811', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
          {busy ? 'Processando…' : 'Swap'}
        </button>
      ) : status === 'quoting' || status === 'swapping' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', color: 'var(--cyan)' }}>
          <span style={{ width: 18, height: 18, border: '2px solid rgba(77,212,255,0.3)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 13 }}>{statusMsg || (status === 'quoting' ? 'Obtendo quote…' : 'Processando swap…')}</span>
        </div>
      ) : null}

      {/* Success */}
      {status === 'success' && txSig && (
        <div style={{ background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.3)', borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 13 }}>
          <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>✓ Swap confirmado!</div>
          <a
            href={`https://solscan.io/tx/${txSig}?cluster=mainnet-beta`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--cyan)', textDecoration: 'underline', fontSize: 12 }}
          >
            Ver no Solscan ↗
          </a>
          <div style={{ marginTop: 8 }}>
            <button onClick={reset} style={{ fontSize: 11, color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Novo swap
            </button>
          </div>
        </div>
      )}

      {/* Error msg */}
      {status === 'error' && statusMsg && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'rgba(255,59,92,0.08)', borderRadius: 8 }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}
