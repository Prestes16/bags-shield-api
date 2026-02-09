"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type Locale = "en" | "pt-BR";

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    launchpad_step1_title: "Token Info",
    launchpad_step1_uploadLabel: "Drag & drop or click to upload (PNG, JPG, GIF, max 2MB)",
    launchpad_step1_replaceLabel: "Replace",
    launchpad_step1_nameLabel: "Token Name",
    launchpad_step1_namePlaceholder: "My Awesome Token",
    launchpad_step1_symbolLabel: "Symbol",
    launchpad_step1_symbolPlaceholder: "MAT",
    launchpad_step1_descriptionLabel: "Token Description (Optional)",
    launchpad_step1_descriptionPlaceholder: "Briefly describe your project...",
    launchpad_step1_charCount: "{current}/{max}",
    launchpad_step2_title: "Configuration",
    launchpad_step2_initialSupply: "Initial Supply",
    launchpad_step2_initialSupplyPlaceholder: "1000000000",
    launchpad_step2_securityParams: "SECURITY PARAMETERS",
    launchpad_step2_renounceMint: "Renounce Mint Authority",
    launchpad_step2_renounceMintDesc: "Revoke ability to mint more tokens",
    launchpad_step2_renounceFreeze: "Renounce Freeze Authority",
    launchpad_step2_renounceFreezeDesc: "Revoke ability to freeze accounts",
    launchpad_step2_lpLock: "Liquidity Pool Lock",
    launchpad_step2_lpLockDesc: "Lock LP tokens for period",
    launchpad_step2_lpLockMonths: "12 MONTHS",
    launchpad_step2_launchWallet: "Launch Wallet",
    launchpad_step2_launchWalletPlaceholder: "Solana wallet address (base58)",
    launchpad_step2_tipWallet: "Tip Wallet (Optional)",
    launchpad_step2_tipAmount: "Tip Amount (Lamports)",
    launchpad_step3_title: "DEPLOYMENT SUMMARY",
    launchpad_step3_subtitle: "Review carefully before signing.",
    launchpad_step3_tokenIdentity: "Token Identity",
    launchpad_step3_initialSupply: "Initial Supply",
    launchpad_step3_securityConfig: "Security Configuration",
    launchpad_step3_mintAuthority: "Mint Authority",
    launchpad_step3_freezeAuthority: "Freeze Authority",
    launchpad_step3_liquidityLock: "Liquidity Lock",
    launchpad_step3_revokedSafe: "REVOKED (Safe)",
    launchpad_step3_keptRisky: "KEPT (Risky)",
    launchpad_step3_estimatedFees: "ESTIMATED NETWORK COST",
    launchpad_step3_feesSubtext: "(Includes Token creation, Metadata, and LP Lock fees)",
    launchpad_step3_signLaunch: "SIGN & LAUNCH TOKEN",
    launchpad_next: "Next",
    launchpad_back: "Back",
    launchpad_continueReview: "Continue to Review",
    launchpad_cancel: "Cancel",
  },
  "pt-BR": {
    launchpad_step1_title: "Informações do Token",
    launchpad_step1_uploadLabel: "Arraste e solte ou clique para enviar (PNG, JPG, GIF, máx 2MB)",
    launchpad_step1_replaceLabel: "Substituir",
    launchpad_step1_nameLabel: "Nome do Token",
    launchpad_step1_namePlaceholder: "Meu Token Incrível",
    launchpad_step1_symbolLabel: "Símbolo",
    launchpad_step1_symbolPlaceholder: "MTI",
    launchpad_step1_descriptionLabel: "Descrição do Token (Opcional)",
    launchpad_step1_descriptionPlaceholder: "Descreva brevemente seu projeto...",
    launchpad_step1_charCount: "{current}/{max}",
    launchpad_step2_title: "Configuração",
    launchpad_step2_initialSupply: "Supply Inicial",
    launchpad_step2_initialSupplyPlaceholder: "1000000000",
    launchpad_step2_securityParams: "PARÂMETROS DE SEGURANÇA",
    launchpad_step2_renounceMint: "Renunciar Autoridade de Mint",
    launchpad_step2_renounceMintDesc: "Revogar capacidade de mintar mais tokens",
    launchpad_step2_renounceFreeze: "Renunciar Autoridade de Freeze",
    launchpad_step2_renounceFreezeDesc: "Revogar capacidade de congelar contas",
    launchpad_step2_lpLock: "Bloqueio de Liquidez",
    launchpad_step2_lpLockDesc: "Bloquear LP por período",
    launchpad_step2_lpLockMonths: "12 MESES",
    launchpad_step2_launchWallet: "Carteira de Launch",
    launchpad_step2_launchWalletPlaceholder: "Endereço da carteira Solana (base58)",
    launchpad_step2_tipWallet: "Carteira de Gorjeta (Opcional)",
    launchpad_step2_tipAmount: "Valor da Gorjeta (Lamports)",
    launchpad_step3_title: "RESUMO DO DEPLOYMENT",
    launchpad_step3_subtitle: "Revise com atenção antes de assinar.",
    launchpad_step3_tokenIdentity: "Identidade do Token",
    launchpad_step3_initialSupply: "Supply Inicial",
    launchpad_step3_securityConfig: "Configuração de Segurança",
    launchpad_step3_mintAuthority: "Autoridade de Mint",
    launchpad_step3_freezeAuthority: "Autoridade de Freeze",
    launchpad_step3_liquidityLock: "Bloqueio de Liquidez",
    launchpad_step3_revokedSafe: "REVOGADO (Seguro)",
    launchpad_step3_keptRisky: "MANTIDO (Arriscado)",
    launchpad_step3_estimatedFees: "CUSTO ESTIMADO DA REDE",
    launchpad_step3_feesSubtext: "(Inclui criação do Token, Metadata e taxas de LP Lock)",
    launchpad_step3_signLaunch: "ASSINAR E LANÇAR TOKEN",
    launchpad_next: "Próximo",
    launchpad_back: "Voltar",
    launchpad_continueReview: "Continuar para Revisão",
    launchpad_cancel: "Cancelar",
  },
};

type LanguageContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = TRANSLATIONS[locale];
      let str = dict[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return str;
    },
    [locale]
  );
  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: (key: string, params?: Record<string, string | number>) => {
        let str = TRANSLATIONS.en[key] ?? key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
          });
        }
        return str;
      },
    };
  }
  return ctx;
}
