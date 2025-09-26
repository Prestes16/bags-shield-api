// api/_engine.js
// Motor de risco: recebe "hints" (vindo da Bags ou de simulate) e calcula score + decisão.
// Sem dependências externas. ESM (import/export) com extensões .js.

export const RISK_THRESHOLDS = {
  SAFE_MAX: 49,   // <= 49 → SAFE
  WARN_MIN: 50,   // 50–79 → WARN
  BLOCK_MIN: 80   // >= 80 → BLOCK
};

export function riskBadge(level) {
  switch (level) {
    case 'block': return { text: 'BLOCK', color: '#FF3B30' };
    case 'warn':  return { text: 'WARN',  color: '#FFD166' };
    default:      return { text: 'SAFE',  color: '#00FFA3' };
  }
}

// Normaliza tipos e aplica limites
function normBool(v)   { return typeof v === 'boolean' ? v : undefined; }
function normPct(v)    { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined; }
function normDays(v)   { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined; }
function normScore01(v){ const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined; }

export function evaluateRisk(hints = {}) {
  // Hints esperados (todos opcionais):
  // - mintAuthorityActive (bool)
  // - top10HoldersPct (0–100)
  // - freezeNotRenounced (bool)
  // - tokenAgeDays (>=0)
  // - liquidityLocked (bool)
  // - creatorReputation (0–100)
  // - socialsOk (bool)
  // - bagsVerified (bool)
  // - liquidityUsd (num) [opcional, só para informação]
  const H = {
    mintAuthorityActive: normBool(hints.mintAuthorityActive),
    top10HoldersPct:     normPct(hints.top10HoldersPct),
    freezeNotRenounced:  normBool(hints.freezeNotRenounced),
    tokenAgeDays:        normDays(hints.tokenAgeDays),
    liquidityLocked:     normBool(hints.liquidityLocked),
    creatorReputation:   normScore01(hints.creatorReputation),
    socialsOk:           normBool(hints.socialsOk),
    bagsVerified:        normBool(hints.bagsVerified),
    liquidityUsd:        Number.isFinite(Number(hints.liquidityUsd)) ? Number(hints.liquidityUsd) : undefined
  };

  let score = 0;
  const factors = [];

  // 1) Mint authority ativa → risco alto
  if (H.mintAuthorityActive === true) {
    score += 25;
    factors.push({ key: 'mint_authority_active', score: 25, detail: 'Mint authority ativa' });
  }

  // 2) Concentração de holders (top10)
  if (H.top10HoldersPct !== undefined) {
    if (H.top10HoldersPct >= 80) {
      score += 25;
      factors.push({ key: 'holders_concentrated', score: 25, detail: `Top10 detém ~${H.top10HoldersPct}%` });
    } else if (H.top10HoldersPct >= 60) {
      score += 15;
      factors.push({ key: 'holders_concentrated', score: 15, detail: `Top10 detém ~${H.top10HoldersPct}%` });
    }
  }

  // 3) Freeze authority não renunciada
  if (H.freezeNotRenounced === true) {
    score += 15;
    factors.push({ key: 'freeze_not_renounced', score: 15, detail: 'Freeze authority não renunciada' });
  }

  // 4) Idade do token (novo é mais arriscado)
  if (H.tokenAgeDays !== undefined) {
    if (H.tokenAgeDays < 3) {
      score += 10;
      factors.push({ key: 'young_token', score: 10, detail: `Token muito novo (${H.tokenAgeDays}d)` });
    } else if (H.tokenAgeDays < 14) {
      score += 5;
      factors.push({ key: 'young_token', score: 5, detail: `Token relativamente novo (${H.tokenAgeDays}d)` });
    }
  }

  // 5) Liquidez
  if (H.liquidityLocked === false) {
    score += 15;
    factors.push({ key: 'liquidity_unlocked', score: 15, detail: 'Liquidez não bloqueada' });
  } else if (H.liquidityLocked === undefined) {
    score += 5;
    factors.push({ key: 'liquidity_unknown', score: 5, detail: 'Status de liquidez desconhecido' });
  }

  // 6) Reputação do criador
  if (H.creatorReputation !== undefined) {
    if (H.creatorReputation <= 20) {
      score += 10;
      factors.push({ key: 'creator_low_reputation', score: 10, detail: 'Reputação do criador baixa' });
    } else if (H.creatorReputation < 50) {
      score += 5;
      factors.push({ key: 'creator_mixed_reputation', score: 5, detail: 'Reputação do criador média' });
    }
  }

  // 7) Presença em redes sociais
  if (H.socialsOk === false) {
    score += 5;
    factors.push({ key: 'no_socials', score: 5, detail: 'Sem presenças sociais' });
  }

  // 8) Verificação pela Bags → reduz risco
  if (H.bagsVerified === true) {
    const delta = Math.min(10, score); // reduz até 10 pontos (sem ficar negativo)
    score -= delta;
    if (delta > 0) {
      factors.push({ key: 'bags_verified', score: -delta, detail: 'Bags verificado' });
    }
  }

  // Score final (0..100)
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Nível e razão
  let level = 'safe';
  let reason = 'Sem sinais relevantes de risco';

  if (score >= RISK_THRESHOLDS.BLOCK_MIN) {
    level = 'block';
    reason = 'Risco crítico detectado';
  } else if (score >= RISK_THRESHOLDS.WARN_MIN) {
    level = 'warn';
    reason = 'Sinais moderados de risco';
  }

  return {
    score,
    decision: level,
    reason,
    risk: {
      level,
      badge: riskBadge(level),
      factors
    }
  };
}
