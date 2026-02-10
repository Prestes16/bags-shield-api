'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { Button } from '@/components/ui/button';

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

function base64ToUint8Array(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function SwapPanel() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const runningRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const [amountSol, setAmountSol] = useState(0.001); // default beta-safe
  const [slippageBps, setSlippageBps] = useState(50);

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [warning, setWarning] = useState<{ code: string; message: string } | null>(null);
  const [status, setStatus] = useState<string>('');

  const base = useMemo(() => process.env.NEXT_PUBLIC_API_BASE ?? '', []);
  const api = (p: string) => `${base}${p}`;

  const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
  const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

  const amountLamports = Math.max(1, Math.floor(amountSol * 1e9)).toString();

  async function guardrails() {
    if (!connected || !publicKey || !signTransaction) {
      setStatus('Conecta a wallet primeiro (e ela precisa suportar signTransaction).');
      return false;
    }

    // saldo mínimo (beta): ~0.002 SOL
    try {
      const bal = await connection.getBalance(publicKey, 'processed');
      if (bal < 2_000_000) {
        setStatus(`Saldo baixo pra teste (precisa ~0.002 SOL). Saldo: ${(bal / 1e9).toFixed(6)} SOL`);
        return false;
      }
    } catch {
      // não bloqueia beta
    }

    return true;
  }

  async function doQuote() {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setWarning(null);
    setStatus('Pegando quote…');

    try {
      const ok = await guardrails();
      if (!ok) return;

      const qUrl = api(
        `/api/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`
      );

      const r = await fetch(qUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const j = await r.json();

      if (!r.ok || !j?.success) throw new Error(`Quote falhou: ${JSON.stringify(j)}`);

      setQuote(j.response);
      setStatus('Quote pronto.');
    } catch (e: any) {
      setStatus(`Erro no quote: ${e?.message ?? String(e)}`);
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
    setStatus('Montando swapTransaction…');

    try {
      const ok = await guardrails();
      if (!ok) return;
      if (!quote) {
        setStatus('Faz o quote primeiro.');
        return;
      }

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
        throw new Error(`Swap build falhou: ${JSON.stringify(sj)}`);
      }

      if (sj.warning) setWarning(sj.warning);

      setStatus('Assinando…');

      const bytes = base64ToUint8Array(sj.response.swapTransaction);
      const tx = VersionedTransaction.deserialize(bytes);

      const signed = await signTransaction!(tx);

      setStatus('Enviando…');

      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      });

      setStatus(`Confirmando… ${sig}`);

      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: sj.response.lastValidBlockHeight ?? latest.lastValidBlockHeight,
        },
        'confirmed'
      );

      setStatus(`✅ Confirmado: ${sig}`);
    } catch (e: any) {
      setStatus(`❌ Erro no swap: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
      runningRef.current = false;
    }
  }

  const quoteOut =
    quote?.outAmount && typeof quote?.outAmount === 'string'
      ? (Number(quote.outAmount) / 1e6).toFixed(6)
      : null;

  const routeLabel = quote?.routePlan?.[0]?.swapInfo?.label ?? null;
  const priceImpact = quote?.priceImpactPct ?? null;

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 backdrop-blur px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Swap (Beta)</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">SOL → USDC</div>
      </div>

      {warning && (
        <div className="mt-3 rounded-lg border border-amber-300/40 bg-amber-100/40 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <div className="font-semibold">{warning.code}</div>
          <div className="opacity-90">{warning.message}</div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-slate-600 dark:text-slate-300">Amount (SOL)</span>
          <input
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            inputMode="decimal"
            value={String(amountSol)}
            onChange={(e) => setAmountSol(Number(e.target.value || '0'))}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-slate-600 dark:text-slate-300">Slippage (bps)</span>
          <input
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            inputMode="numeric"
            value={String(slippageBps)}
            onChange={(e) => setSlippageBps(Number(e.target.value || '0'))}
          />
        </label>

        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" disabled={busy} onClick={doQuote}>
            {busy ? '…' : 'Quote'}
          </Button>
          <Button className="flex-1" disabled={busy || !quote} onClick={doSwap}>
            {busy ? '…' : 'Swap'}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <span className="opacity-70">Est. out:</span> {quoteOut ?? '—'} USDC
            </div>
            <div>
              <span className="opacity-70">Route:</span> {routeLabel ?? '—'}
            </div>
            <div>
              <span className="opacity-70">Impact:</span> {priceImpact ?? '—'}
            </div>
          </div>
          <div className="mt-2 break-words opacity-90">{status || '—'}</div>
        </div>
      </div>
    </div>
  );
}
