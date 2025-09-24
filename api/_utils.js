// api/_utils.js
import { z } from 'zod';
import { APP_VERSION } from './_version.js';

/** Níveis/cores de risco (UI futura) */
export const RISK_LEVELS = {
  safe:  { level: 'safe',  scoreMin: 0,  scoreMax: 29,  badge: { text: 'SAFE',  color: '#00FFA3' } },
  warn:  { level: 'warn',  scoreMin: 30, scoreMax: 59,  badge: { text: 'WARN',  color: '#FFD600' } },
  flag:  { level: 'flag',  scoreMin: 60, scoreMax: 79,  badge: { text: 'FLAG',  color: '#FF8A00' } },
  block: { level: 'block', scoreMin: 80, scoreMax: 100, badge: { text: 'BLOCK', color: '#FF3B30' } }
};

export function riskFromScore(score) {
  if (score <= RISK_LEVELS.safe.scoreMax) return RISK_LEVELS.safe;
  if (score <= RISK_LEVELS.warn.scoreMax) return RISK_LEVELS.warn;
  if (score <= RISK_LEVELS.flag.scoreMax) return RISK_LEVELS.flag;
  return RISK_LEVELS.block;
}

/** Base sem transform/refine — pode fazer .extend() em outros arquivos */
export const ScanBaseSchema = z.object({
  mint: z.string().min(32).max(64).optional(),
  tokenMint: z.string().min(32).max(64).optional(),
  transactionSig: z.string().min(8).max(120).optional(), // min 8 (relaxado)
  network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  context: z.object({
    wallet: z.string().optional(),
    appId: z.string().optional()
  }).optional()
});

/** Versão com transform/refine — para usos diretos */
export const ScanInputSchema = ScanBaseSchema
  .transform((data) => ({
    ...data,
    mint: data.mint ?? data.tokenMint ?? undefined
  }))
  .refine((data) => data.mint || data.transactionSig, {
    message: 'Forneça mint/tokenMint ou transactionSig.'
  });

/** Engine de risco mockável (Fase 3) */
export function computeRiskFactors(input) {
  const factors = [];

  const mintAuthorityActive = input?.mock?.mintAuthorityActive ?? true;
  if (mintAuthorityActive) factors.push({ key: 'mint_authority_active', score: 25, detail: 'Mint authority ativa' });

  const top10Pct = input?.mock?.top10HoldersPct ?? 78;
  if (top10Pct >= 70) factors.push({ key: 'holders_concentrated', score: 25, detail: `Top10 detém ~${top10Pct}%` });
  else if (top10Pct >= 40) factors.push({ key: 'holders_mid_concentration', score: 10, detail: `Top10 detém ~${top10Pct}%` });

  const freezeNotRenounced = input?.mock?.freezeNotRenounced ?? true;
  if (freezeNotRenounced) factors.push({ key: 'freeze_not_renunciated', score: 15, detail: 'Freeze authority não renunciada' });

  const ageDays = input?.mock?.tokenAgeDays ?? 2;
  if (ageDays < 3) factors.push({ key: 'young_token', score: 10, detail: `Token muito novo (${ageDays}d)` });

  const liquidityLocked = input?.mock?.liquidityLocked ?? false;
  if (!liquidityLocked) factors.push({ key: 'liquidity_unlocked', score: 15, detail: 'Liquidez não bloqueada' });

  const creatorReputation = input?.mock?.creatorReputation ?? 60;
  if (creatorReputation >= 70) factors.push({ key: 'creator_low_reputation', score: 10, detail: 'Reputação do criador baixa' });
  else if (creatorReputation >= 40) factors.push({ key: 'creator_mixed_reputation', score: 5, detail: 'Reputação do criador média' });

  let total = factors.reduce((s, f) => s + f.score, 0);
  total = Math.min(100, total);

  return { factors, total };
}

/** Resposta padrão */
export function buildResponse({ id, decision, reason, input, risk }) {
  const riskLvl = riskFromScore(risk.total);
  return {
    ok: true,
    id,
    decision,
    reason,
    score: risk.total,
    risk: {
      level: riskLvl.level,
      badge: riskLvl.badge,
      factors: risk.factors
    },
    network: input.network,
    tokenMint: input.mint ?? null,
    transactionSig: input.transactionSig ?? null,
    requestedBy: input?.context?.wallet ? `phantom:${input.context.wallet}` : 'client:unknown',
    ts: new Date().toISOString()
  };
}

/** Helpers HTTP */
export async function readJson(req) {
  return new Promise((resolve, reject) => {
    try {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  // Conteúdo + cache
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // Observabilidade
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader('X-BagsShield', '1');

  // Segurança básica
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');

  res.end(JSON.stringify(data));
}
