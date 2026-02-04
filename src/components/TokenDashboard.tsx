'use client';

import { useState, useEffect } from 'react';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Shield, AlertTriangle, Lock, Unlock, ArrowDown, Loader2 } from 'lucide-react';

// Interfaces
interface TokenDashboardProps {
  scanData: {
    tokenInfo: { name: string; symbol: string; image: string; mint: string };
    security: { score: number; isSafe: boolean; mintAuthority?: boolean; lpLocked?: boolean };
    integrity?: { isVerified?: boolean };
  } | null;
  loading: boolean;
  wallet: WalletContextState;
  connection: any;
  buildSwapTransactionOnly: (quote: any) => Promise<VersionedTransaction>;
  // NOVA PROP OBRIGATÓRIA PARA I18N
  lang?: 'pt' | 'en';
}

// Dicionário de Tradução (i18n)
const t = {
  pt: {
    riskTitle: "RISCO CRÍTICO DETECTADO",
    riskBody: "Este token tem pontuação baixa de segurança. O Bags Shield não recomenda a compra.",
    confirmRisk: "Estou ciente, quero comprar",
    cancel: "Cancelar",
    swap: "Comprar Agora",
    swapping: "Processando...",
    approving: "Aguardando Assinatura...",
    confirming: "Confirmando na Blockchain...",
    success: "Sucesso! Transação enviada.",
    balance: "Saldo",
    pay: "Você Paga",
    receive: "Você Recebe",
    verified: "Verificado (Bags)",
    warning: "Alerta de Risco",
    mintAuth: "Autoridade de Mint",
    liquidity: "Liquidez",
    connect: "Conecte a carteira!"
  },
  en: {
    riskTitle: "CRITICAL RISK DETECTED",
    riskBody: "This token has a low security score. Bags Shield does not recommend buying it.",
    confirmRisk: "I understand, proceed",
    cancel: "Cancel",
    swap: "Buy Now",
    swapping: "Processing...",
    approving: "Waiting for Signature...",
    confirming: "Confirming on Blockchain...",
    success: "Success! Transaction sent.",
    balance: "Balance",
    pay: "You Pay",
    receive: "You Receive",
    verified: "Verified (Bags)",
    warning: "Risk Warning",
    mintAuth: "Mint Authority",
    liquidity: "Liquidity",
    connect: "Connect wallet!"
  }
};

export function TokenDashboard({ scanData, loading, wallet, connection, buildSwapTransactionOnly, lang = 'pt' }: TokenDashboardProps) {
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<any>(null);
  const [outAmount, setOutAmount] = useState<string>('0');
  const [isSwapping, setIsSwapping] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Garante que lang seja 'pt' ou 'en' para evitar erro de índice
  const currentLang = (lang === 'pt' || lang === 'en') ? lang : 'pt';
  const txt = t[currentLang];

  // 1. Saldo em Tempo Real
  useEffect(() => {
    if (wallet.publicKey && connection) {
      connection.getBalance(wallet.publicKey).then((val: number) => setBalance(val / LAMPORTS_PER_SOL));
    }
  }, [wallet.publicKey, connection]);

  // 2. Cotação Visual — API interna Jupiter V1
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !scanData) return;
      try {
        const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
        const outputMint = scanData.tokenInfo.mint;
        const amountLamports = Math.floor(Number(amount) * LAMPORTS_PER_SOL);

        const res = await fetch(`/api/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=50`);
        const data = await res.json();

        if (data.success && data.response?.outAmount) {
          setQuote(data.response);
          setOutAmount((Number(data.response.outAmount) / (10 ** 6)).toFixed(4));
        }
      } catch (e) {
        console.error("Erro na cotação visual", e);
      }
    };
    const timeout = setTimeout(fetchQuote, 600);
    return () => clearTimeout(timeout);
  }, [amount, scanData]);

  // 3. Clique no Swap
  const handleSwapClick = () => {
    if (!wallet.connected) return alert(txt.connect);
    if (!amount || !quote) return;

    if (scanData && scanData.security.score < 50) {
      setShowRiskModal(true);
    } else {
      executeTransaction();
    }
  };

  // 4. Execução
  const executeTransaction = async () => {
    if (!wallet.publicKey || !scanData) return;

    setIsSwapping(true);
    setStatusMsg(txt.approving);
    setShowRiskModal(false);

    try {
      const transaction = await buildSwapTransactionOnly(quote);
      const signature = await wallet.sendTransaction(transaction, connection);

      setStatusMsg(txt.confirming);
      await connection.confirmTransaction(signature, 'confirmed');

      setStatusMsg(txt.success);
      setAmount('');
      setOutAmount('0');
      setTimeout(() => setStatusMsg(''), 4000);

    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("User rejected")) {
        setStatusMsg("Cancelado/Rejected.");
      } else {
        setStatusMsg("Error.");
      }
    } finally {
      setIsSwapping(false);
    }
  };

  // --- UI DO LOADING ---
  if (loading || !scanData) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4 animate-pulse p-4">
        <div className="h-24 bg-white/5 rounded-2xl w-full" />
        <div className="h-64 bg-white/5 rounded-2xl w-full" />
      </div>
    );
  }

  const scoreColor = scanData.security.score >= 80 ? 'text-green-400' : scanData.security.score >= 50 ? 'text-yellow-400' : 'text-red-500';
  const scoreBorder = scanData.security.score >= 80 ? 'border-green-500/20' : scanData.security.score >= 50 ? 'border-yellow-500/20' : 'border-red-500/20';
  const mintAuthority = scanData.security.mintAuthority ?? false;
  const lpLocked = scanData.security.lpLocked ?? false;

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto pb-24">
      {/* HEADER */}
      <div className="flex flex-col items-center pt-4">
        <div className={`relative w-24 h-24 rounded-full border-4 ${scoreBorder} p-1 shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]`}>
          <img
            src={scanData.tokenInfo.image || "/placeholder.png"}
            onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/800px-Bitcoin.svg.png"; }}
            className="w-full h-full rounded-full object-cover bg-black"
            alt={scanData.tokenInfo.symbol}
          />
          {scanData.integrity?.isVerified && (
            <div className="absolute -bottom-2 -right-2 bg-[#06b6d4] text-black p-1.5 rounded-full border-2 border-[#020617]">
              <Shield size={16} fill="currentColor" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold mt-4 text-white">{scanData.tokenInfo.name}</h1>
        <div className="flex items-center gap-2 text-white/50">
          <span className="text-sm font-mono">{scanData.tokenInfo.symbol}</span>
        </div>
      </div>

      {/* DASHBOARD STATUS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden">
          <span className="text-xs text-white/40 uppercase mb-1">{txt.warning}</span>
          <span className={`text-4xl font-bold ${scoreColor}`}>{scanData.security.score}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className={`flex-1 flex items-center justify-between px-4 rounded-xl border ${mintAuthority ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            <span className="text-xs font-medium">{txt.mintAuth}</span>
            {mintAuthority ? <Unlock size={14}/> : <Lock size={14}/>}
          </div>
          <div className={`flex-1 flex items-center justify-between px-4 rounded-xl border ${lpLocked ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
            <span className="text-xs font-medium">{txt.liquidity}</span>
            {lpLocked ? <Lock size={14}/> : <Unlock size={14}/>}
          </div>
        </div>
      </div>

      {/* SWAP CARD */}
      <div className={`bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl relative transition-all ${isSwapping ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>{txt.pay}</span>
          <span>{txt.balance}: {balance.toFixed(3)} SOL</span>
        </div>
        <div className="bg-[#020617]/50 border border-white/10 rounded-xl p-3 flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">SOL</div>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-transparent text-xl font-bold w-full outline-none text-right placeholder-white/20 text-white"
          />
        </div>

        <div className="flex justify-center -my-3 relative z-10">
          <div className="bg-[#020617] p-1.5 rounded-full border border-white/10">
            <ArrowDown size={16} className="text-cyan-400" />
          </div>
        </div>

        <div className="bg-[#020617]/50 border border-white/10 rounded-xl p-3 flex items-center gap-3 mt-2 mb-6">
          <img src={scanData.tokenInfo.image || "/placeholder.png"} alt="" className="w-8 h-8 rounded-full" />
          <input type="text" readOnly value={outAmount} className="bg-transparent text-xl font-bold w-full outline-none text-right text-white/50" />
        </div>

        <button
          onClick={handleSwapClick}
          disabled={!amount || isSwapping}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
            ${scanData.security.score < 50 ? 'bg-red-500 hover:bg-red-600' : 'bg-[#06b6d4] hover:bg-[#0891b2] text-[#020617]'}
          `}
        >
          {isSwapping ? <Loader2 className="animate-spin" /> : scanData.security.score < 50 ? <AlertTriangle /> : null}
          {isSwapping ? statusMsg : scanData.security.score < 50 ? txt.warning : txt.swap}
        </button>

        {statusMsg && !isSwapping && <p className="text-center text-xs mt-3 text-cyan-400">{statusMsg}</p>}
      </div>

      {/* MODAL DE RISCO */}
      {showRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-red-500/50 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-500 mb-2">{txt.riskTitle}</h2>
              <p className="text-white/70 text-sm mb-6">{txt.riskBody}</p>
              <button onClick={executeTransaction} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold mb-3">{txt.confirmRisk}</button>
              <button onClick={() => setShowRiskModal(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium">{txt.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
