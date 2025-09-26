// api/apply.js
// Aplica (sugere) ações com base na decisão de risco.
// Integra com Bags quando possível (igual ao scan), ou aceita mock como no simulate.

import { APP_VERSION } from './_version.js';
import { getBagsTokenInfo, hintsFromBags } from './_bags.js';
import { evaluateRisk } from './_engine.js';

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
const genId = (p = 'bsa') => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return {};
}

function actionsFromDecision(score, decision) {
  if (decision === 'block' || score >= 80) {
    return [
      { type: 'deny_transaction', reason: 'score >= 80' },
      { type: 'alert_user', message: 'Risco crítico — transação bloqueada.' }
    ];
  }
  if (decision === 'warn' || (score >= 50 && score <= 79)) {
    return [
      { type: 'require_manual_review', message: 'Risco moderado — requer revisão manual.' }
    ];
  }
  return [
    { type: 'allow', message: 'Seguro dentro dos parâmetros.' }
  ];
}

export default async function handler(req, res) {
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
    const transactionSig = body.transactionSig ? String(body.transactionSig) : null;
    let mint = body.mint ? String(body.mint) : (body.tokenMint ? String(body.tokenMint) : null);
    const mock = (body.mock && typeof body.mock === 'object') ? body.mock : null;

    // MVP: se veio transactionSig válida (8+), aplica ação placeholder e sai
    if (transactionSig && transactionSig.length >= 8) {
      const out = {
        ok: true,
        id: genId('bsa'),
        decision: 'warn',
        reason: 'Transação analisada superficialmente (MVP txOnly).',
        score: 50,
        risk: {
          level: 'warn',
          badge: { text: 'WARN', color: '#FFD166' },
          factors: [{ key: 'tx_only', score: 50, detail: 'Apenas assinatura; resolução de mint virá na Fase 4.' }]
        },
        network,
        tokenMint: null,
        transactionSig,
        requestedBy,
        ts: nowIso(),
        actions: [{ type: 'require_manual_review', message: 'Apenas assinatura informada — revisar.' }]
      };
      res.status(200).send(JSON.stringify(out));
      return;
    }

    if (!mint) {
      res.status(400).send(JSON.stringify({
        ok:false, error:{ code:400, message:'Campo "mint" (ou alias "tokenMint") é obrigatório' }
      }));
      return;
    }
    if (mint.length < 32) {
      res.status(400).send(JSON.stringify({
        ok:false, error:{ code:400, message:'mint inválido — mínimo de 32 caracteres' }
      }));
      return;
    }

    // Hints: se veio mock, usa mock; senão tenta Bags
    let hints = {};
    let bags = { ok:false, tried:[] };
    if (mock) {
      hints = {
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
    } else {
      const bagsResp = await getBagsTokenInfo({ mint, network });
      bags = {
        ok: !!bagsResp.ok,
        base: bagsResp.base,
        status: bagsResp.status,
        rateLimit: bagsResp.rateLimit,
        tried: bagsResp.tried || [],
        raw: bagsResp.ok ? (bagsResp.raw || {}) : undefined
      };
      if (bagsResp.ok) hints = hintsFromBags(bagsResp.raw);
    }

    // Avalia risco e define ações
    const risk = evaluateRisk(hints);
    const actions = actionsFromDecision(risk.score, risk.decision);

    const out = {
      ok: true,
      id: genId('bsa'),
      decision: risk.decision,
      reason: 'Decisão aplicada (MVP: somente sugestão de ações)',
      score: risk.score,
      risk: risk.risk,
      network,
      tokenMint: mint,
      transactionSig: transactionSig || null,
      requestedBy,
      ts: nowIso(),
      actions,
      ...(mock ? { mockUsed:true } : { bags })
    };

    res.status(200).send(JSON.stringify(out));
  } catch (err) {
    res.status(200).send(JSON.stringify({
      ok:false, error:{ code:500, message:String(err?.message || err) }, ts: nowIso()
    }));
  }
}
