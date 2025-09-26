// api/apply.js
// ESM — Aplica uma decisão "operacional" (MVP) com base em /scan-like + hints/mocks.
// Agora resolve transactionSig→mint (Fase 4) usando Solana RPC.

import { SOLANA } from './_solana.js';

const APP_VERSION = process.env.APP_VERSION || '0.3.8';

function applySecurityHeaders(res) {
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader('X-Bagsshield', '1');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  res.setHeader('Cache-Control', 'no-store');
}

async function readJson(req) {
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

function decideFromScore(score) {
  if (score >= 80) return { level: 'block', badge: { text: 'BLOCK', color: '#FF3B30' }, decision: 'block', reason: 'Risco crítico detectado' };
  if (score >= 40) return { level: 'warn',  badge: { text: 'WARN',  color: '#FFD166' }, decision: 'warn',  reason: 'Sinais moderados de risco' };
  return                 { level: 'safe',  badge: { text: 'SAFE',  color: '#00FFA3' }, decision: 'safe',  reason: 'Sem sinais relevantes de risco' };
}

function newId(prefix) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}_${s}`;
}

// Ações simples para o MVP
function actionsForDecision(decision, noteSafe = 'Seguro dentro dos parâmetros.') {
  if (decision === 'block') return [
    { type: 'deny_transaction', reason: 'score >= 80' },
    { type: 'alert_user', message: 'Risco crítico — transação bloqueada.' },
  ];
  if (decision === 'warn') return [
    { type: 'require_manual_review', message: 'Apenas assinatura informada — revisar.' },
  ];
  return [{ type: 'allow', message: noteSafe }];
}

// (opcional) Bags mínima (mesma da scan.js)
const BAGS = {
  base: 'https://public-api-v2.bags.fm',
  pathCreator: '/api/v1/token-launch/creator/v3',
  async fetchCreator(mint, { timeoutMs = 8000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const tried = [];
    try {
      const url = `${this.base}${this.pathCreator}?tokenMint=${encodeURIComponent(mint)}`;
      const headers = { 'content-type': 'application/json' };
      const apiKey = process.env.BAGS_API_KEY;
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
      const rateLimit = {
        remaining: res.headers.get('X-RateLimit-Remaining') || undefined,
        reset:     res.headers.get('X-RateLimit-Reset') || undefined,
      };
      let raw; try { raw = await res.json(); } catch { raw = null; }

      tried.push({ base: this.base, path: this.pathCreator, url, status: res.status, ok: res.ok, rateLimit });
      if (!res.ok) return { ok: false, base: this.base, status: res.status, rateLimit, tried, raw };

      const hints = {};
      const arr = Array.isArray(raw?.response) ? raw.response : [];
      const first = arr[0] || raw;
      hints.bagsVerified = Boolean(first?.verified || first?.bagsVerified);

      return { ok: true, base: this.base, status: res.status, rateLimit, tried, raw, hints };
    } catch {
      tried.push({ base: this.base, path: this.pathCreator, ok: false, error: 'fetch_failed' });
      return { ok: false, reason: 'http_or_network_error', message: 'Falha ao chamar Bags', tried };
    } finally {
      clearTimeout(t);
    }
  },
};

export default async function handler(req, res) {
  applySecurityHeaders(res);

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const ts = new Date().toISOString();
  const id = newId('bsa');

  try {
    const body = await readJson(req);
    let { mint, tokenMint, transactionSig, network = 'devnet', mock, context = {} } = body || {};
    mint = mint || tokenMint || null;

    // Fase 4 — resolver mint se vier só a assinatura
    let tx = null;
    if (!mint && transactionSig && typeof transactionSig === 'string') {
      const txRes = await SOLANA.resolveMintFromTx(transactionSig, { network });
      tx = txRes;
      if (txRes?.ok && txRes?.mint) mint = txRes.mint;
    }

    // MVP: se ainda não resolvemos mint, retornar warn/txOnly
    if (!mint) {
      const score = 50;
      const { level, badge, decision, reason } = decideFromScore(score);
      return res.status(200).json({
        ok: true,
        id,
        decision,
        reason: 'Transação analisada superficialmente (MVP txOnly).',
        score,
        risk: { level, badge, factors: [{ key: 'tx_only', score: 50, detail: 'Apenas assinatura; resolução de mint pode falhar.' }] },
        network,
        tokenMint: null,
        transactionSig: transactionSig || null,
        requestedBy: context?.wallet ? `wallet:${context.wallet}` : 'client:unknown',
        ts,
        actions: actionsForDecision(decision, 'Seguro dentro dos parâmetros.'),
        tx,
      });
    }

    // Hints mockáveis (caso a UI chame /apply com "mock")
    let score = 5;
    const factors = [];
    if (mock && typeof mock === 'object') {
      // reaproveitar a mesma lógica da simulate: cada indicador piora o score
      if (mock.mintAuthorityActive)     { score += 25; factors.push({ key: 'mint_authority_active',     score: 25, detail: 'Mint authority ativa' }); }
      if (typeof mock.top10HoldersPct === 'number') {
        const pct = mock.top10HoldersPct;
        const s = pct >= 80 ? 25 : pct >= 60 ? 15 : pct >= 40 ? 10 : 0;
        if (s) { score += s; factors.push({ key: 'holders_concentrated', score: s,  detail: `Top10 detém ~${pct}%` }); }
      }
      if (mock.freezeNotRenounced)      { score += 15; factors.push({ key: 'freeze_not_renounced',      score: 15, detail: 'Freeze authority não renunciada' }); }
      if (typeof mock.tokenAgeDays === 'number') {
        const days = mock.tokenAgeDays;
        const s = days <= 2 ? 10 : days <= 7 ? 5 : 0;
        if (s) { score += s; factors.push({ key: 'young_token', score: s, detail: `Token muito novo (${days}d)` }); }
      }
      if (mock.liquidityLocked === false){ score += 15; factors.push({ key: 'liquidity_unlocked',       score: 15, detail: 'Liquidez não bloqueada' }); }
      if (typeof mock.creatorReputation === 'number') {
        const rep = mock.creatorReputation;
        const s = rep <= 10 ? 10 : rep <= 30 ? 5 : 0;
        if (s) { score += s; factors.push({ key: 'creator_low_reputation', score: s, detail: 'Reputação do criador baixa' }); }
      }
      if (mock.socialsOk === false)     { score += 5;  factors.push({ key: 'no_socials',                score: 5,  detail: 'Sem presenças sociais' }); }
      if (mock.bagsVerified === true)   { score = Math.max(0, score - 20); /* bônus */ }
    } else {
      // Sem mock → consultar Bags para reduzir score ou manter SAFE alto por falta de dados
      const bags = await BAGS.fetchCreator(mint);
      if (bags?.ok) {
        score = 5;
        factors.push({ key: 'liquidity_unknown', score: 5, detail: 'Status de liquidez desconhecido' });
      } else {
        score = 25;
        factors.push({ key: 'liquidity_unknown',  score: 5,  detail: 'Status de liquidez desconhecido' });
        factors.push({ key: 'insufficient_data',  score: 20, detail: 'Poucos sinais disponíveis' });
      }
    }

    const { level, badge, decision, reason } = decideFromScore(score);

    // Ações MVP
    const actions = actionsForDecision(decision);

    res.status(200).json({
      ok: true,
      id,
      decision,
      reason: 'Decisão aplicada (MVP: somente sugestão de ações)',
      score,
      risk: { level, badge, factors },
      network,
      tokenMint: mint,
      transactionSig: transactionSig || null,
      requestedBy: context?.wallet ? `wallet:${context.wallet}` : 'client:unknown',
      ts,
      actions,
      // opcional: não retornamos o objeto completo da Bags para manter resposta mais leve no /apply
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'internal_error',
      message: (err && err.message) || 'unexpected',
      ts,
    });
  }
}
