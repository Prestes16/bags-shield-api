"use client";

import { Info, ArrowRight } from "lucide-react";
import { formatLamportsToSolString } from "@/lib/fees";
import { APP_COSTS_TEAM_WALLET, APP_PUBLIC_RESERVE_WALLET } from "@/lib/constants";

interface FeeBreakdownCardProps {
  feeTotal: bigint;
  feeSplit: {
    costs: bigint;
    reserve: bigint;
  };
  action: "SCAN" | "SWAP";
  lang?: "en" | "pt";
}

export function FeeBreakdownCard({
  feeTotal,
  feeSplit,
  action,
  lang = "en",
}: FeeBreakdownCardProps) {
  const t = {
    en: {
      appFee: "App Fee",
      notNetworkFee: "This is the app fee, not the network fee",
      total: "Total",
      distribution: "Distribution",
      costs: "Operations & Team (35%)",
      reserve: "Public Reserve (65%)",
      reserveDesc: "For improvements & potential airdrops",
    },
    pt: {
      appFee: "Taxa do App",
      notNetworkFee: "Esta é a taxa do app, não a taxa da rede",
      total: "Total",
      distribution: "Distribuição",
      costs: "Operações & Equipe (35%)",
      reserve: "Reserva Pública (65%)",
      reserveDesc: "Para melhorias & possíveis airdrops",
    },
  }[lang];

  return (
    <div className="bg-bg-card border-2 border-[var(--cyan-primary)]/20 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--cyan-primary)]/10 flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-[var(--cyan-primary)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-text-primary mb-1">
            {t.appFee} ({action})
          </h3>
          <p className="text-xs text-text-muted">{t.notNetworkFee}</p>
        </div>
      </div>

      {/* Total Fee */}
      <div className="bg-bg-card-hover/50 rounded-xl p-3 border border-border-subtle">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">{t.total}</span>
          <span className="text-sm font-bold text-[var(--cyan-primary)]">
            {formatLamportsToSolString(feeTotal)}
          </span>
        </div>
      </div>

      {/* Distribution */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-text-secondary">{t.distribution}</h4>
        
        {/* Costs/Team */}
        <div className="bg-bg-input/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{t.costs}</span>
            <span className="text-xs font-semibold text-text-primary">
              {formatLamportsToSolString(feeSplit.costs)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3 h-3 text-[var(--cyan-primary)] flex-shrink-0" />
            <code className="text-[9px] text-text-muted font-mono truncate">
              {APP_COSTS_TEAM_WALLET}
            </code>
          </div>
        </div>

        {/* Reserve */}
        <div className="bg-bg-input/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs text-text-muted mb-0.5">{t.reserve}</div>
              <div className="text-[10px] text-text-muted/70">{t.reserveDesc}</div>
            </div>
            <span className="text-xs font-semibold text-text-primary">
              {formatLamportsToSolString(feeSplit.reserve)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3 h-3 text-[var(--cyan-primary)] flex-shrink-0" />
            <code className="text-[9px] text-text-muted font-mono truncate">
              {APP_PUBLIC_RESERVE_WALLET}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
