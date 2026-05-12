'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SwapPanel } from '@/components/solana/SwapPanel';
import { ConnectWalletButton } from '@/components/solana/ConnectWalletButton';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const QUICK_PICKS = [
  { symbol: 'USDC', mint: USDC_MINT, decimals: 6 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  { symbol: 'POPCAT', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', decimals: 9 },
];

function SwapContent() {
  const searchParams = useSearchParams();
  const paramOutputMint = searchParams.get('outputMint');
  const paramOutputSymbol = searchParams.get('outputSymbol');
  const paramOutputDecimals = searchParams.get('outputDecimals');

  const [outputMint, setOutputMint] = useState(paramOutputMint || USDC_MINT);
  const [outputSymbol, setOutputSymbol] = useState(paramOutputSymbol || 'USDC');
  const [outputDecimals, setOutputDecimals] = useState(Number(paramOutputDecimals) || 6);

  const selectToken = (t: typeof QUICK_PICKS[0]) => {
    setOutputMint(t.mint);
    setOutputSymbol(t.symbol);
    setOutputDecimals(t.decimals);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 120px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)' }}>Swap</h1>
        <ConnectWalletButton />
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius)', backdropFilter: 'blur(16px)', padding: 24, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both' }}>
        {/* Quick picks */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--txt3)', display: 'block', marginBottom: 8 }}>Token de saída</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PICKS.map((t) => (
              <button
                key={t.mint}
                onClick={() => selectToken(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: outputMint === t.mint ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.1)',
                  background: outputMint === t.mint ? 'rgba(77,212,255,0.1)' : 'transparent',
                  color: outputMint === t.mint ? 'var(--cyan)' : 'var(--txt2)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.symbol}
              </button>
            ))}
          </div>
        </div>

        <SwapPanel
          inputMint={SOL_MINT}
          inputSymbol="SOL"
          inputDecimals={9}
          outputMint={outputMint}
          outputSymbol={outputSymbol}
          outputDecimals={outputDecimals}
          defaultAmountSol={0.01}
        />
      </div>

      {/* Footer */}
      <p style={{ marginTop: 20, fontSize: 11, color: 'var(--txt3)', textAlign: 'center' }}>
        Powered by Jupiter Aggregator · 0.5% fee
      </p>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt2)' }}>Carregando…</div>}>
      <SwapContent />
    </Suspense>
  );
}
