// api/simulate.js
// Simula uma decisão de risco usando "hints" enviados pelo cliente (mock).
// Sem dependências externas. ESM + imports com extensão .js.

import { APP_VERSION } from './_version.js';
import { evaluateRisk, riskBadge } from './_engine.js';

function setCommonHeaders(res) {
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader('X-Bagsshield', '1');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}
const nowIso = () => new Date().toISOString();
const genId = (p = 'bss') => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return {};
}

export default function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).send(JSON.stringify({ ok:false, error:{ code:405, message:'Method Not Allowed — use POST' } }));
    return;
  }

  try {
    const body = parseJsonBody(req);
    const requestedBy = (req.headers['x-client'] || 'client:unknown');

    const network = (body.network || 'devnet').toString();
    const mint = body.mint ? String(body.mint) : (body.tokenMint ? String(body.tokenMint) : null);
    const mock = (body.mock && typeof body.mock === 'object') ? body.mock : {};

    if (!mint) {
      res.status(400).send(JSON.stringify({
        ok:false, error:{ code:400, message:'Campo "mint" (ou alias "tokenMint") é obrigatório' }
      }));
      return;
    }

    // Apenas normaliza os campos que o engine entende (demais são ignorados)
    const hints = {
      mintAuthorityActive: typeof mock.mintAuthorityActive === 'boolean' ? mock.mintAuthorityActive : undefined,
      top10HoldersPct: Number.isFinite(Number(mock.top10HoldersPct)) ? Number(mock.top10HoldersPct) : undefined,
      freezeNotRenounced: typeof mock.freezeNotRenounced === 'boolean' ? mock.freezeNotRenounced : undefined,
      tokenAgeDays: Number.isFinite(Number(mock.tokenAgeDays)) ? Number(mock.tokenAgeDays) : undefined,
      liquidityLocked: typeof mock.liquidityLocked === 'boolean' ? mock.liquidityLocked : undefined,
      creatorReputation: Number.isFinite(Number(mock.creatorReputation)) ? Number(mock.creatorReputation) : undefined,
      socialsOk: typeof mock.socialsOk === 'boolean' ? mock.socialsOk : undefined,
      bagsVerified: typeof mock.bagsVerified === 'boolean' ? mock.bagsVerified : undefined,
      liquidityUsd: Number.isFinite(Number(mock.liquidityUsd)) ? Number(mock.liquidityUsd) : undefined
    };

    const risk = evaluateRisk(hints);
    const out = {
      ok: true,
      id: genId('bss'),
      decision: risk.decision,
      reason: 'Simulação de decisão de risco com base nos parâmetros mockados',
      score: risk.score,
      risk: risk.risk,
      network,
      tokenMint: mint,
      transactionSig: null,
      requestedBy,
      ts: nowIso()
    };

    res.status(200).send(JSON.stringify(out));
  } catch (err) {
    res.status(200).send(JSON.stringify({
      ok:false, error:{ code:500, message:String(err?.message || err) }, ts: nowIso()
    }));
  }
}
