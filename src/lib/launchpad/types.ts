/**
 * Domain Types for Bags Shield Launchpad
 * 
 * Core types representing the domain model for token launch operations.
 */

/**
 * Token Draft - Rascunho de token antes do lançamento
 */
export interface TokenDraft {
  /** Nome do token (1-32 caracteres) */
  name: string;
  
  /** Símbolo do token (1-10 caracteres) */
  symbol: string;
  
  /** Número de decimais (0-18) */
  decimals: number;
  
  /** Descrição do token (opcional, máx 500 caracteres) */
  description?: string;
  
  /** URL da imagem do token (deve ser HTTP/HTTPS válido, anti-SSRF) */
  imageUrl?: string;
  
  /** Website do projeto (opcional, HTTP/HTTPS válido) */
  websiteUrl?: string;
  
  /** Twitter/X handle (opcional, sem @) */
  twitterHandle?: string;
  
  /** Telegram handle (opcional) */
  telegramHandle?: string;
}

/**
 * Launch Configuration Draft - Configuração de lançamento
 */
export interface LaunchConfigDraft {
  /** Wallet Solana que fará o lançamento (pubkey válido) */
  launchWallet: string;
  
  /** Wallet para receber tip (opcional, pubkey válido) */
  tipWallet?: string;
  
  /** Valor do tip em lamports (opcional, requerido se tipWallet fornecido) */
  tipLamports?: number;
  
  /** Configurações adicionais do token */
  token: TokenDraft;
  
  /** Metadados adicionais (opcional) */
  metadata?: Record<string, unknown>;
}

/**
 * Preflight Report - Relatório de validação pré-lançamento
 */
export interface PreflightReport {
  /** Se todas as validações passaram */
  isValid: boolean;
  
  /** Lista de issues encontradas (vazia se isValid = true) */
  issues: Array<{
    /** Caminho do campo com problema (ex: "token.name", "imageUrl") */
    path: string;
    
    /** Mensagem de erro descritiva */
    message: string;
    
    /** Severidade do problema */
    severity: "error" | "warning" | "info";
  }>;
  
  /** Warnings não bloqueantes */
  warnings: Array<{
    path: string;
    message: string;
  }>;
  
  /** Timestamp da validação (ISO 8601) */
  validatedAt: string;
  
  /** Request ID para rastreamento */
  requestId: string;
}

/**
 * Shield Proof Manifest - Manifesto de prova do Shield
 * 
 * Representa as validações e badges de segurança aplicados ao token.
 */
export interface ShieldProofManifest {
  /** Mint address do token (após criação) */
  mint: string;
  
  /** Shield Score (0-100) */
  shieldScore: number;
  
  /** Grade de risco (A-E) */
  grade: "A" | "B" | "C" | "D" | "E";
  
  /** Se o token é considerado seguro */
  isSafe: boolean;
  
  /** Badges de segurança aplicados */
  badges: Array<{
    /** Chave única do badge */
    key: string;
    
    /** Título do badge */
    title: string;
    
    /** Severidade */
    severity: "low" | "medium" | "high" | "critical";
    
    /** Impacto */
    impact: "negative" | "neutral" | "positive";
    
    /** Tags para categorização */
    tags: string[];
  }>;
  
  /** Resumo textual da avaliação */
  summary: string;
  
  /** Timestamp da avaliação (ISO 8601) */
  evaluatedAt: string;
  
  /** Request ID para rastreamento */
  requestId: string;
}
