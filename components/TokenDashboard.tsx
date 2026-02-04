'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Shield, AlertTriangle, Lock, Unlock, ArrowDown, Loader2 } from 'lucide-react';

// Interfaces compatíveis com o seu page.tsx
interface TokenInfo {
  name: string;
  symbol: string;
  image: string;
  mint: string;
}

interface SecurityData {
  score: number;
  isSafe: boolean;
  mintAuthority?: boolean;
  freezeAuthority?: boolean;
  lpLocked?: boolean;
}

interface ScanData {
  tokenInfo: TokenInfo;
  security: SecurityData;
  integrity?: { isVerified: boolean };
}

interface TokenDashboardProps {
  scanData: ScanData | null;
  loading: boolean;
  wallet: WalletContextState;
  connection: ReturnType<typeof useConnection>['connection'];
  buildSwapTransactionOnly: (quote: any, userPublicKey: string, isSafe: boolean) => Promise<VersionedTransaction>;
}

// Dicionário de Tradução
const t = {
  pt: {
    riskTitle: "RISCO CRÍTICO DETECTADO",
    riskBody: "Este token apresenta sinais de alto risco (Score baixo). A compra não é recomendada pelo Bags Shield.",
    confirmRisk: "Estou ciente, quero comprar",
    cancel: "Cancelar",
    swap: "Comprar Agora",
    swapping: "Processando...",
    approving: "Aguardando Aprovação...",
    balance: "Saldo",
    pay: "Você Paga",
    receive: "Você Recebe",
    verified: "Verificado (Bags)",
    warning: "Alerta de Risco"
  }
};

export function TokenDashboard({ scanData, loading, wallet, connection, buildSwapTransactionOnly }: TokenDashboardProps) {
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<any>(null);
  const [outAmount, setOutAmount] = useState<string>('0');
  const [isSwapping, setIsSwapping] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // 1. Busca Saldo Real
  useEffect(() => {
    if (wallet.publicKey && connection) {
      connection.getBalance(wallet.publicKey).then((val: number) => setBalance(val / LAMPORTS_PER_SOL));
    }
  }, [wallet.publicKey, connection]);

  // 2. Busca Cotação via API interna (Jupiter V1 - api.jup.ag)
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !scanData) return;

      try {
        const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
        const outputMint = scanData.tokenInfo.mint;
        const amountLamports = Math.floor(Number(amount) * LAMPORTS_PER_SOL);

        const res = await fetch(`/api/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=50`);
        const data = await res.json();

        if (data.success && data.response) {
          const quoteData = data.response;
          setQuote(quoteData);
          // Ajuste básico de decimais (assumindo 6 decimais para maioria dos tokens)
          const outVal = quoteData.outAmount ? Number(quoteData.outAmount) / 1_000_000 : 0;
          setOutAmount(outVal.toFixed(4));
        }
      } catch (e) {
        console.error("Erro na cotação", e);
      }
    };

    const timeout = setTimeout(fetchQuote, 600); // Debounce
    return () => clearTimeout(timeout);
  }, [amount, scanData]);

  // 3. Handler do Botão Swap
  const handleSwapClick = () => {
    if (!wallet.connected) {
      alert("Por favor, conecte sua carteira.");
      return;
    }
    if (!amount || !quote) return;

    // Lógica de Risco
    if (scanData && scanData.security.score < 50) {
      setShowRiskModal(true);
    } else {
      executeTransaction();
    }
  };

  // 4. Execução Real da Transação
  const executeTransaction = async () => {
    if (!wallet.publicKey || !scanData) return;

    setIsSwapping(true);
    setStatusMsg(t.pt.approving);
    setShowRiskModal(false);

    try {
      // A. Constrói a transação (usando sua API blindada)
      const transaction = await buildSwapTransactionOnly(quote, wallet.publicKey.toBase58(), scanData.security.isSafe);

      // B. Envia para a Carteira Assinar
      const signature = await wallet.sendTransaction(transaction, connection);

      setStatusMsg("Confirmando na Blockchain...");

      // C. Aguarda confirmação
      await connection.confirmTransaction(signature, 'confirmed');

      setStatusMsg("Sucesso! Transação enviada.");
      setAmount('');
      setOutAmount('0');

      // Reset msg após 3s
      setTimeout(() => setStatusMsg(''), 3000);

    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("User rejected")) {
        setStatusMsg("Cancelado pelo usuário.");
      } else {
        setStatusMsg("Falha na transação.");
      }
    } finally {
      setIsSwapping(false);
    }
  };

  // --- SKELETON LOADING ---
  if (loading || !scanData) {
    return (
      <div className="flex flex-col gap-4 animate-pulse w-full max-w-md mx-auto">
        <div className="h-24 bg-white/5 rounded-2xl w-full" />
        <div className="h-64 bg-white/5 rounded-2xl w-full" />
        <div className="h-12 bg-white/5 rounded-xl w-full" />
      </div>
    );
  }

  const security = scanData.security;
  const mintAuthority = security.mintAuthority ?? false;
  const lpLocked = security.lpLocked ?? false;
  const isVerified = scanData.integrity?.isVerified ?? false;

  const scoreColor = security.score >= 80 ? 'text-green-400' : security.score >= 50 ? 'text-yellow-400' : 'text-red-500';
  const scoreBorder = security.score >= 80 ? 'border-green-500/20' : security.score >= 50 ? 'border-yellow-500/20' : 'border-red-500/20';

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto pb-24">
      {/* HEADER: Token Info */}
      <div className="flex flex-col items-center justify-center pt-4">
        <div className={`relative w-24 h-24 rounded-full border-4 ${scoreBorder} p-1 shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]`}>
          <img
            src={scanData.tokenInfo.image || "/placeholder.png"}
            onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/800px-Bitcoin.svg.png"; }}
            alt={scanData.tokenInfo.symbol}
            className="w-full h-full rounded-full object-cover bg-black"
          />
          {isVerified && (
            <div className="absolute -bottom-2 -right-2 bg-[#06b6d4] text-black p-1.5 rounded-full border-2 border-[#020617]">
              <Shield size={16} fill="currentColor" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold mt-4">{scanData.tokenInfo.name}</h1>
        <div className="flex items-center gap-2 text-white/50">
          <span className="text-sm font-mono">{scanData.tokenInfo.symbol}</span>
          {isVerified && (
            <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
              {t.pt.verified}
            </span>
          )}
        </div>
      </div>

      {/* GAUGE & STATS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
          <span className="text-xs text-white/40 uppercase tracking-wider mb-1">Nível de Blindagem</span>
          <span className={`text-4xl font-bold ${scoreColor}`}>{security.score}</span>
          <div className={`absolute inset-0 opacity-10 blur-xl ${scoreColor.replace('text-', 'bg-')}`}></div>
        </div>
        <div className="flex flex-col gap-3">
          <div className={`flex-1 flex items-center justify-between px-4 rounded-xl border ${mintAuthority ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            <span className="text-xs font-medium">Mint Auth</span>
            {mintAuthority ? <Unlock size={14}/> : <Lock size={14}/>}
          </div>
          <div className={`flex-1 flex items-center justify-between px-4 rounded-xl border ${lpLocked ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
            <span className="text-xs font-medium">Liquidez</span>
            {lpLocked ? <Lock size={14}/> : <Unlock size={14}/>}
          </div>
        </div>
      </div>

      {/* SWAP WIDGET */}
      <div className={`bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden transition-all ${isSwapping ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* Input SOL */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between text-xs text-white/40 px-1">
            <span>{t.pt.pay}</span>
            <span>{t.pt.balance}: {balance.toFixed(3)} SOL</span>
          </div>
          <div className="bg-[#020617]/50 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xs">SOL</div>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-xl font-bold w-full outline-none text-right placeholder-white/20"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="flex justify-center -my-2 relative z-10">
          <div className="bg-[#020617] p-1.5 rounded-full border border-white/10">
            <ArrowDown size={16} className="text-cyan-400" />
          </div>
        </div>

        {/* Output Token */}
        <div className="flex flex-col gap-2 mt-2 mb-6">
          <div className="flex justify-between text-xs text-white/40 px-1">
            <span>{t.pt.receive}</span>
          </div>
          <div className="bg-[#020617]/50 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <img src={scanData.tokenInfo.image || "/placeholder.png"} alt="" className="w-8 h-8 rounded-full" />
            <input
              type="text"
              readOnly
              value={outAmount}
              className="bg-transparent text-xl font-bold w-full outline-none text-right text-white/50"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSwapClick}
          disabled={!amount || isSwapping}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]
            ${security.score < 50
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)]'
              : 'bg-[#06b6d4] hover:bg-[#0891b2] text-[#020617] shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)]'}
          `}
        >
          {isSwapping ? (
            <>
              <Loader2 className="animate-spin" /> {statusMsg || t.pt.swapping}
            </>
          ) : security.score < 50 ? (
            <>
              <AlertTriangle size={20} /> {t.pt.warning}
            </>
          ) : (
            <>{t.pt.swap}</>
          )}
        </button>

        {statusMsg && !isSwapping && (
          <p className="text-center text-xs mt-3 text-cyan-400 animate-fade-in">{statusMsg}</p>
        )}
      </div>

      {/* RISK MODAL */}
      {showRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-red-500/50 w-full max-w-sm rounded-2xl p-6 shadow-2xl shadow-red-900/20">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-red-500/10 p-4 rounded-full">
                <AlertTriangle size={48} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-red-500">{t.pt.riskTitle}</h2>
              <p className="text-white/70 text-sm">{t.pt.riskBody}</p>

              <div className="flex flex-col gap-3 w-full mt-2">
                <button
                  onClick={executeTransaction}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
                >
                  {t.pt.confirmRisk}
                </button>
                <button
                  onClick={() => setShowRiskModal(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium"
                >
                  {t.pt.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
