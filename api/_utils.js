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

/**
 * Engine de risco v0.3.6
 * - NÃO penaliza por padrão quando não há sinal (antes gerava 95).
 * - Aplica penalidades só quando o sinal vier definido (mock/hints).
 * - Se houver poucos sinais, adiciona "insufficient_data" (+20) para evitar falso SAFE.
 */
export function computeRiskFactors(input) {
  const m = input?.mock ?? {};
  const factors = [];
  let signals = 0;

  // Mint authority ativa = risco
  if (m.mintAuthorityActive === true) {
    factors.push({ key: 'mint_authority_active', score: 25, detail: 'Mint authority ativa' });
    signals++;
  } else if (m.mintAuthorityActive === false) {
    signals++;
  }

  // Concentração holders
  if (typeof m.top10HoldersPct === 'number' && !Number.isNaN(m.top10HoldersPct)) {
    if (m.top10HoldersPct >= 70) {
      factors.push({ key: 'holders_concentrated', score: 25, detail: `Top10 detém ~${m.top10HoldersPct}%` });
    } else if (m.top10HoldersPct >= 40) {
      factors.push({ key: 'holders_mid_concentration', score: 10, detail: `Top10 detém ~${m.top10HoldersPct}%` });
    }
    signals++;
  }

  // Freeze não renunciada
  if (m.freezeNotRenounced === true) {
    factors.push({ key: 'freeze_not_renounced', score: 15, detail: 'Freeze authority não renunciada' });
    signals++;
  } else if (m.freezeNotRenounced === false) {
    signals++;
  }

  // Idade do token
  if (typeof m.tokenAgeDays === 'number' && !Number.isNaN(m.tokenAgeDays)) {
    if (m.tokenAgeDays < 3) {
      factors.push({ key: 'young_token', score: 10, detail: `Token muito novo (${m.tokenAgeDays}d)` });
    } else if (m.tokenAgeDays < 14) {
      factors.push({ key: 'new_token', score: 5, detail: `Token novo (${m.tokenAgeDays}d)` });
    }
    signals++;
  }

  // Liquidez
  if (m.liquidityLocked === false) {
    factors.push({ key: 'liquidity_unlocked', score: 15, detail: 'Liquidez não bloqueada' });
    signals++;
  } else if (m.liquidityLocked === true) {
    signals++;
  } else {
    // Se não sabemos nada de liquidez e não for verificado, leve aviso
    if (m.bagsVerified !== true) {
      factors.push({ key: 'liquidity_unknown', score: 5, detail: 'Status de liquidez desconhecido' });
    }
  }

  // Reputação do criador
  if (typeof m.creatorReputation === 'number' && !Number.isNaN(m.creatorReputation)) {
    if (m.creatorReputation < 40) {
      factors.push({ key: 'creator_low_reputation', score: 10, detail: 'Reputação do criador baixa' });
    } else if (m.creatorReputation < 60) {
      factors.push({ key: 'creator_mixed_reputation', score: 5, detail: 'Reputação do criador média' });
    }
    signals++;
  }

  // Socials
  if (m.socialsOk === false) {
    factors.push({ key: 'no_socials', score: 5, detail: 'Sem redes sociais vinculadas' });
    signals++;
  } else if (m.socialsOk === true) {
    signals++;
  }

  // Verificado (evita aviso de dados insuficientes/unknown)
  const isVerified = m.bagsVerified === true;
  if (m.bagsVerified !== undefined) signals++;

  // Poucos sinais? adiciona aviso
  if (!isVerified && signals < 2) {
    factors.push({ key: 'insufficient_data', score: 20, detail: 'Poucos sinais disponíveis' });
  }

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
