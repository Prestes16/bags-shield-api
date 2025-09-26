// api/scan.js
// ESM — Node 18+ (Vercel serverless). Resolve transactionSig→mint (Fase 4) e integra Bags.
// Mantém resposta estável (id/decision/score/risk/bags/tx), com header X-App-Version.

import { SOLANA } from './_solana.js';

// --------- util headers & helpers ----------
const APP_VERSION = process.env.APP_VERSION || '0.3.8';

function applySecurityHeaders(res) {
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader('X-Bagsshield', '1');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  // para rotas dinâmicas: não cachear
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

// --------- Bags integration (local, estável) ----------
const BAGS = {
  base: 'https://public-api-v2.bags.fm',
  pathCreator: '/api/v1/token-launch/creator/v3', // ?tokenMint=<mint>

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

      let raw;
      try { raw = await res.json(); } catch { raw = null; }

      tried.push({ base: this.base, path: this.pathCreator, url, status: res.status, ok: res.ok, rateLimit });
      if (!res.ok) {
        return { ok: false, base: this.base, status: res.status, rateLimit, tried, raw };
      }

      // Hints simples (mantém compatibilidade de shape)
      const hints = {};
      if (raw && typeof raw === 'object') {
        // Se no futuro o payload da Bags trouxer sinal de verificação
        const arr = Array.isArray(raw.response) ? raw.response : [];
        const first = arr[0] || raw;
        const verified = Boolean(first?.verified || first?.bagsVerified);
        hints.bagsVerified = verified;
      }

      return { ok: true, base: this.base, status: res.status, rateLimit, tried, raw, hints };
    } catch {
      tried.push({ base: this.base, path: this.pathCreator, ok: false, error: 'fetch_failed' });
      return { ok: false, reason: 'http_or_network_error', message: 'Falha ao chamar Bags', tried };
    } finally {
      clearTimeout(t);
    }
  },
};

// --------- Handler ----------
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
  const id = newId('bsr');

  try {
    const body = await readJson(req);
    let { mint, tokenMint, transactionSig, network = 'devnet', context = {} } = body || {};
    mint = mint || tokenMint || null;

    // Fase 4 — resolver mint a partir de transactionSig
    let tx = null;
    if (!mint && transactionSig && typeof transactionSig === 'string') {
      const txRes = await SOLANA.resolveMintFromTx(transactionSig, { network });
      tx = txRes;
      if (txRes?.ok && txRes?.mint) mint = txRes.mint;
    }

    // Se ainda não temos mint, responder em modo txOnly (compatível com MVP anterior)
    if (!mint) {
      res.status(200).json({
        ok: true,
        txOnly: true,
        transactionSig: transactionSig || null,
        note: 'Assinatura recebida. Não foi possível resolver o mint nesta consulta.',
        network,
        ts,
        tx,
      });
      return;
    }

    // Consultar Bags (não obrigatório para decidir — mas melhora o score)
    const bags = await BAGS.fetchCreator(mint);

    // Score base: se Bags respondeu 200 → 5 (SAFE baixo), senão 25 (SAFE alto por falta de dados)
    let score = bags?.ok ? 5 : 25;
    const factors = [];
    if (bags?.ok) {
      factors.push({ key: 'liquidity_unknown', score: 5, detail: 'Status de liquidez desconhecido' });
    } else {
      factors.push({ key: 'liquidity_unknown', score: 5, detail: 'Status de liquidez desconhecido' });
      factors.push({ key: 'insufficient_data', score: 20, detail: 'Poucos sinais disponíveis' });
    }

    const { level, badge, decision, reason } = decideFromScore(score);

    res.status(200).json({
      ok: true,
      id,
      decision,
      reason,
      score,
      risk: { level, badge, factors },
      network,
      tokenMint: mint,
      transactionSig: transactionSig || null,
      requestedBy: context?.wallet ? `wallet:${context.wallet}` : 'client:unknown',
      ts,
      bags: bags || { ok: false, reason: 'not_called' },
      tx,
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
