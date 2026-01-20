"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FindingDetails, type FindingData } from "@/components/bags-shield/finding-details";

// Mock data for demonstration
const mockFindings: Record<string, FindingData> = {
  "mint-authority": {
    id: "mint-authority",
    title: "Mint Authority Enabled",
    severity: "high",
    description:
      "O token possui autoridade de mint ativa, o que significa que o criador do contrato ainda tem permissao para criar novos tokens a qualquer momento. Isso representa um risco significativo pois a oferta total pode ser inflacionada sem aviso previo.",
    impact:
      "O criador pode gerar tokens infinitos e vende-los no mercado, causando diluicao massiva do valor. Investidores podem perder grande parte do seu investimento se houver um mint inesperado seguido de venda.",
    rawData: {
      mintAuthority: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      freezeAuthority: null,
      supply: "1000000000",
      decimals: 9,
      isInitialized: true,
      mintAuthorityOption: 1,
    },
  },
  "freeze-authority": {
    id: "freeze-authority",
    title: "Freeze Authority Present",
    severity: "medium",
    description:
      "O token possui autoridade de congelamento ativa. Isso permite que o criador congele qualquer carteira que possua este token, impedindo transferencias e vendas.",
    impact:
      "Sua carteira pode ser congelada a qualquer momento, impossibilitando a venda ou transferencia dos seus tokens. Isso pode ser usado para manipular o mercado ou como forma de extorsao.",
    rawData: {
      freezeAuthority: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      affectedAccounts: 1247,
      lastFreezeAction: null,
    },
  },
  "top-holders": {
    id: "top-holders",
    title: "Top Holders 28%",
    severity: "high",
    description:
      "Os 10 maiores holders possuem 28% do supply total do token. Uma concentracao alta de tokens em poucas carteiras representa risco de manipulacao de preco.",
    impact:
      "Grandes holders podem coordenar vendas massivas (dump) causando queda abrupta no preco. Tambem podem manipular o preco atraves de compras e vendas coordenadas.",
    rawData: {
      topHolders: [
        { rank: 1, percentage: "8.5%", address: "7xKX...gAsU" },
        { rank: 2, percentage: "6.2%", address: "9pQR...mNvW" },
        { rank: 3, percentage: "4.8%", address: "3tYU...kLpZ" },
      ],
      totalConcentration: "28%",
      holderCount: 4521,
    },
  },
  "liquidity-locked": {
    id: "liquidity-locked",
    title: "Liquidity Locked",
    severity: "info",
    description:
      "A liquidez do token esta bloqueada em um contrato de lock. Isso significa que os provedores de liquidez nao podem remover a liquidez durante o periodo de lock.",
    impact:
      "Este e um sinal positivo! Liquidez bloqueada reduz o risco de rug pull, pois o criador nao pode simplesmente remover toda a liquidez e fugir com os fundos.",
    rawData: {
      lockContract: "RaydiumLock_v1",
      lockDuration: "365 days",
      lockedAmount: "500000 USDC",
      unlockDate: "2026-01-15T00:00:00Z",
      lockerAddress: "Lock...xYz",
    },
  },
};

export default function FindingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [finding, setFinding] = useState<FindingData | null>(null);
  const resolvedId = id; // Declare resolvedId variable

  useEffect(() => {
    if (!id) return;

    // Simulate API loading
    const timer = setTimeout(() => {
      const data = mockFindings[id];
      if (data) {
        setFinding(data);
      }
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [id]);

  const handleBack = () => {
    router.push("/");
  };

  if (!finding && !isLoading) {
    return (
      <div className="min-h-screen bg-bg-page text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Finding not found</p>
          <button
            onClick={handleBack}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <FindingDetails
      finding={
        finding || {
          id: "",
          title: "",
          severity: "info",
          description: "",
          impact: "",
          rawData: {},
        }
      }
      onBack={handleBack}
      isLoading={isLoading}
    />
  );
}
