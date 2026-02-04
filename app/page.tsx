'use client';

import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSearchParams } from 'next/navigation';
import { Shield } from 'lucide-react';
import { buildSwapTransactionOnly } from '@/src/hooks/useJupiterSwap';
import { TokenDashboard } from '@/src/components/TokenDashboard';
import type { JupiterQuoteResponse } from '@/src/services/jupiter';
import type { VersionedTransaction } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

// Tipagem compatível com TokenDashboard
interface ScanData {
  tokenInfo: { name: string; symbol: string; image: string; mint: string };
  security: { score: number; isSafe: boolean; mintAuthority?: boolean; lpLocked?: boolean };
  integrity?: { isVerified?: boolean };
}

export default function DashboardPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const searchParams = useSearchParams();
  
  // 1. Pega o Mint da URL (fundamental para Deep Link do Seeker)
  // Ex: bagsshield://app?mint=So11...
  const mintAddress = searchParams.get('mint') || 'So11111111111111111111111111111111111111112';

  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);

  // Idioma (temporário até plugar no settings context; ex.: const { lang } = useSettings())
  const currentLang: 'pt' | 'en' = 'pt';

  // 2. Fetch de Dados Reais (Token Info + Security)
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/token/${mintAddress}`);

        if (!res.ok) {
          console.error('[Dashboard] API token falhou:', res.status, res.statusText);
          setScanData({
            tokenInfo: { name: 'Token', symbol: '—', image: '', mint: mintAddress },
            security: { score: 0, isSafe: false },
            integrity: { isVerified: false },
          });
          setLoading(false);
          return;
        }

        const data = await res.json().catch((e: Error) => {
          console.error('[Dashboard] JSON inválido da API token:', e);
          return null;
        });

        if (data?.success && data?.response) {
          setScanData({
            tokenInfo: data.response.tokenInfo,
            security: data.response.security,
            integrity: data.response.integrity,
          });
        } else {
          setScanData({
            tokenInfo: { name: 'Token', symbol: '—', image: '', mint: mintAddress },
            security: { score: 0, isSafe: false },
            integrity: { isVerified: false },
          });
        }
      } catch (error) {
        console.error('[Dashboard] Falha no fetch token:', error);
        setScanData({
          tokenInfo: { name: 'Token', symbol: '—', image: '', mint: mintAddress },
          security: { score: 0, isSafe: false },
          integrity: { isVerified: false },
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [mintAddress]);

  // 3. A Função Wrapper que conecta Segurança + Swap
  const handleBuildTransaction = async (quote: JupiterQuoteResponse): Promise<VersionedTransaction> => {
    if (!scanData || !wallet.publicKey) {
      throw new Error("Carteira ou Dados inválidos");
    }
    
    // Aqui usamos seu hook novo que já verifica o 'isSafe'
    // Nota: O hook precisa do 'isSafe' que vem do scanData
    const isSafe = scanData.security.isSafe; 
    
    return await buildSwapTransactionOnly(quote, wallet.publicKey.toBase58(), isSafe);
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white flex flex-col p-4">
      {/* Se não conectou, mostra botão de conectar (UI simples de fallback) */}
      {!wallet.connected && (
        <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
          <Shield className="w-20 h-20 text-cyan-400 animate-pulse" aria-hidden />
          <h1 className="text-xl font-bold">Conecte sua carteira para iniciar</h1>
          <WalletMultiButton
            className="!rounded-xl"
            style={{ backgroundColor: '#06b6d4', borderRadius: '12px', fontWeight: 'bold' }}
          />
        </div>
      )}

      {/* Dashboard Oficial */}
      {wallet.connected && (
        <TokenDashboard
          scanData={scanData}
          loading={loading}
          wallet={wallet}
          connection={connection}
          buildSwapTransactionOnly={handleBuildTransaction}
          lang={currentLang}
        />
      )}
    </main>
  );
}
