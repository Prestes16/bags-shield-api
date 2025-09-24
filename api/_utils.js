// api/_utils.js
import { z } from 'zod';

/**
 * Paleta & níveis de risco (preferência visual do projeto)
 */
export const RISK_LEVELS = {
  safe:   { level: 'safe',   scoreMin: 0,  scoreMax: 29,  badge: { text: 'SAFE',   color: '#00FFA3' } }, // verde neon
  warn:   { level: 'warn',   scoreMin: 30, scoreMax: 59,  badge: { text: 'WARN',   color: '#FFD600' } }, // amarelo
  flag:   { level: 'flag',   scoreMin: 60, scoreMax: 79,  badge: { text: 'FLAG',   color: '#FF8A00' } }, // laranja
  block:  { level: 'block',  scoreMin: 80, scoreMax: 100, badge: { text: 'BLOCK',  color: '#FF3B30' } }  // vermelho
};

export function riskFromScore(score) {
  if (score <= RISK_LEVELS.safe.scoreMax) return RISK_LEVELS.safe;
  if (score <= RISK_LEVELS.warn.scoreMax) return RISK_LEVELS.warn;
  if (score <= RISK_LEVELS.flag.scoreMax) return RISK_LEVELS.flag;
  return RISK_LEVELS.block;
}

/**
 * Schema base p/ rotas: aceitamos token ou tx, e opcionalmente contexto do usuário.
 * Para o MVP, tratamos tudo como mockável/estimável. Integrações on-chain vêm na Fase 4.
 */
export const ScanInputSchema = z.object({
  tokenMint: z.string().min(32).max(64).optional(),
  transactionSig: z.string().min(32).max(120).optional(),
  network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  // Contexto opcional p/ heurísticas
  context: z.object({
    wallet: z.string().optional(),
    appId: z.string().optional(),
  }).optional()
}).refine((data) => data.tokenMint || data.transactionSig, {
  message: 'Forneça tokenMint ou transactionSig.'
});

/**
 * Regras de risco mockáveis.
 * score (0-100): quanto MAIOR, pior.
 */
export function computeRiskFactors(input) {
  const factors = [];

  // Heurística 1: mint authority ativa (simulada por padrão)
  const mintAuthorityActive = input?.mock?.mintAuthorityActive ?? true;
  if (mintAuthorityActive) factors.push({ key: 'mint_authority_active', score: 25, detail: 'Mint authority ativa' });

  // Heurística 2: holders concentrados (simulação via % top10)
  const top10Pct = input?.mock?.top10HoldersPct ?? 78; // 0..100
  if (top10Pct >= 70) factors.push({ key: 'holders_concentrated', score: 25, detail: `Top10 detém ~${top10Pct}%` });
  else if (top10Pct >= 40) factors.push({ key: 'holders_mid_concentration', score: 10, detail: `Top10 detém ~${top10Pct}%` });

  // Heurística 3: freeze authority não renunciada
  const freezeNotRenounced = input?.mock?.freezeNotRenounced ?? true;
  if (freezeNotRenounced) factors.push({ key: 'freeze_not_renounced', score: 15, detail: 'Freeze authority não renunciada' });

  // Heurística 4: idade do token (dias)
  const ageDays = input?.mock?.tokenAgeDays ?? 2;
  if (ageDays < 3) factors.push({ key: 'young_token', score: 10, detail: `Token muito novo (${ageDays}d)` });

  // Heurística 5: liquidez bloqueada (mock)
  const liquidityLocked = input?.mock?.liquidityLocked ?? false;
  if (!liquidityLocked) factors.push({ key: 'liquidity_unlocked', score: 15, detail: 'Liquidez não bloqueada' });

  // Heurística 6: reputação do criador (mock 0-100; 0=boa, 100=ruim)
  const creatorReputation = input?.mock?.creatorReputation ?? 60;
  if (creatorReputation >= 70) factors.push({ key: 'creator_low_reputation', score: 10, detail: 'Reputação do criador baixa' });
  else if (creatorReputation >= 40) factors.push({ key: 'creator_mixed_reputation', score: 5, detail: 'Reputação do criador média' });

  // Soma limitada a 100
  let total = factors.reduce((s, f) => s + f.score, 0);
  total = Math.min(100, total);

  return { factors, total };
}

/**
 * Formata resposta padrão
 */
export function buildResponse({ id, decision, reason, input, risk }) {
  const riskLvl = riskFromScore(risk.total);
  return {
    ok: true,
    id,
    decision, // 'safe' | 'warn' | 'flag' | 'block'
    reason,
    score: risk.total, // 0..100 (quanto maior pior)
    risk: {
      level: riskLvl.level,
      badge: riskLvl.badge, // ex.: { text: 'FLAG', color: '#FF8A00' }
      factors: risk.factors
    },
    network: input.network,
    tokenMint: input.tokenMint ?? null,
    transactionSig: input.transactionSig ?? null,
    requestedBy: input?.context?.wallet ? `phantom:${input.context.wallet}` : 'client:unknown',
    ts: new Date().toISOString()
  };
}

/**
 * Helper de body JSON nas rotas Vercel/Node
 */
export async function readJson(req) {
  return new Promise((resolve, reject) => {
    try {
      let body = '';
      req.on('data', (chunk) => body += chunk);
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

