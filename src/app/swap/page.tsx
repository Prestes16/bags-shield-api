'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { SwapPanel } from '@/components/solana/SwapPanel';
import { ConnectWalletButton } from '@/components/solana/ConnectWalletButton';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

interface WalletToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  rawBalance: string;
  logoURI?: string;
  verified: boolean;
  isNative: boolean;
}

const FALLBACK_TOKENS: WalletToken[] = [
  {
    mint: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    balance: 0,
    rawBalance: '0',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    verified: true,
    isNative: true,
  },
  {
    mint: USDC_MINT,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    balance: 0,
    rawBalance: '0',
    verified: true,
    isNative: false,
  },
];

function TokenButton({
  token,
  selected,
  onClick,
}: {
  token: WalletToken;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 10,
        border: selected ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.1)',
        background: selected ? 'rgba(77,212,255,0.1)' : 'rgba(255,255,255,0.03)',
        color: selected ? 'var(--cyan)' : 'var(--txt2)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {token.logoURI && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={token.logoURI}
          alt={token.symbol}
          width={16}
          height={16}
          style={{ borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <span>{token.symbol}</span>
      {token.balance > 0 && (
        <span style={{ fontSize: 10, color: selected ? 'var(--cyan)' : 'var(--txt3)', fontFamily: 'monospace' }}>
          {token.balance < 0.0001 ? '<0.0001' : token.balance.toFixed(4)}
        </span>
      )}
    </button>
  );
}

function SwapContent() {
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();

  // ── Tokens reais da wallet ──────────────────────────────────────────────
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokensError, setTokensError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setWalletTokens([]);
      setTokensError(null);
      return;
    }

    let cancelled = false;
    setLoadingTokens(true);
    setTokensError(null);

    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    fetch(`${base}/api/wallet/tokens?wallet=${publicKey.toBase58()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success && Array.isArray(j.tokens)) {
          setWalletTokens((j.tokens as WalletToken[]).filter((t) => t.balance > 0));
        } else {
          setTokensError(j.error ?? 'Erro ao carregar tokens');
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setTokensError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingTokens(false);
      });

    return () => { cancelled = true; };
  }, [connected, publicKey]);

  const displayTokens = walletTokens.length > 0 ? walletTokens : FALLBACK_TOKENS;

  // ── Par de troca ────────────────────────────────────────────────────────
  const paramOutputMint     = searchParams.get('outputMint');
  const paramOutputSymbol   = searchParams.get('outputSymbol');
  const paramOutputDecimals = searchParams.get('outputDecimals');

  const [inputToken, setInputToken] = useState<WalletToken>({
    mint: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    balance: 0,
    rawBalance: '0',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    verified: true,
    isNative: true,
  });

  const [outputToken, setOutputToken] = useState<WalletToken>({
    mint: paramOutputMint ?? USDC_MINT,
    symbol: paramOutputSymbol ?? 'USDC',
    name: paramOutputSymbol ?? 'USD Coin',
    decimals: Number(paramOutputDecimals) || 6,
    balance: 0,
    rawBalance: '0',
    verified: true,
    isNative: false,
  });

  // Quando tokens carregarem, sincroniza saldo do inputToken
  useEffect(() => {
    if (walletTokens.length === 0) return;
    const found = walletTokens.find((t) => t.mint === inputToken.mint);
    if (found) setInputToken(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletTokens]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 120px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)' }}>Swap</h1>
        <ConnectWalletButton />
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius)', backdropFilter: 'blur(16px)', padding: 24, animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both' }}>

        {/* Token de entrada */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
              {connected ? 'Você paga (sua wallet)' : 'Você paga'}
            </span>
            {connected && loadingTokens && (
              <span style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                Carregando tokens…
              </span>
            )}
            {connected && !loadingTokens && tokensError && (
              <span style={{ fontSize: 10, color: 'var(--red)' }}>⚠ {tokensError}</span>
            )}
            {connected && !loadingTokens && !tokensError && walletTokens.length === 0 && (
              <span style={{ fontSize: 10, color: 'var(--txt3)' }}>Nenhum token com saldo</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {displayTokens.map((t) => (
              <TokenButton
                key={t.mint}
                token={t}
                selected={inputToken.mint === t.mint}
                onClick={() => {
                  if (t.mint === outputToken.mint) setOutputToken(inputToken);
                  setInputToken(t);
                }}
              />
            ))}
          </div>
        </div>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>↓</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Token de saída */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--txt3)', display: 'block', marginBottom: 8 }}>Você recebe</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {displayTokens
              .filter((t) => t.mint !== inputToken.mint)
              .map((t) => (
                <TokenButton
                  key={t.mint}
                  token={{ ...t, balance: 0 }}
                  selected={outputToken.mint === t.mint}
                  onClick={() => setOutputToken(t)}
                />
              ))}
            {/* USDC como fallback se não estiver na lista */}
            {!displayTokens.find((t) => t.mint === USDC_MINT) && inputToken.mint !== USDC_MINT && (
              <TokenButton
                token={{ mint: USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: 0, rawBalance: '0', verified: true, isNative: false }}
                selected={outputToken.mint === USDC_MINT}
                onClick={() => setOutputToken({ mint: USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: 0, rawBalance: '0', verified: true, isNative: false })}
              />
            )}
          </div>
        </div>

        {/* SwapPanel */}
        <SwapPanel
          inputMint={inputToken.mint}
          inputSymbol={inputToken.symbol}
          inputDecimals={inputToken.decimals}
          outputMint={outputToken.mint}
          outputSymbol={outputToken.symbol}
          outputDecimals={outputToken.decimals}
          defaultAmountSol={inputToken.isNative ? 0.01 : 1}
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
