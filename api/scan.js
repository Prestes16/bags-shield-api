// api/scan.js
// Handler do scan: recebe { mint | tokenMint | transactionSig, network? }, integra com Bags e calcula decisão.
// Sem dependências externas. Requer _version.js, _bags.js, _engine.js no mesmo diretório.

import { APP_VERSION } from './_version.js';
import { getBagsTokenInfo, hintsFromBags } from './_bags.js';
import { evaluateRisk, riskBadge } from './_engine.js';

// ------------------------
// Utils locais
// ------------------------
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

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix = 'bsr') {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

function parseJsonBody(req) {
  // Vercel normalmente já parseia JSON, mas garantimos:
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { /* cai no retorno {} */ }
  }
  return {};
}

// ------------------------
// Handler
// ------------------------
export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send(JSON.stringify({
      ok: false,
      error: { code: 405, message: 'Method Not Allowed — use POST' }
    }));
    return;
  }

  try {
    const body = parseJsonBody(req);
    const requestedBy = (req.headers['x-client'] || 'client:unknown');

    // Normaliza campos
    const network = (body.network || 'devnet').toString();
    const transactionSig = body.transactionSig ? String(body.transactionSig) : null;
    let mint = body.mint ? String(body.mint) : null;

    // alias: tokenMint -> mint
    if (!mint && body.tokenMint) mint = String(body.tokenMint);

    // MVP: aceitar transactionSig (8+ chars) e retornar txOnly
    if (transactionSig && transactionSig.length >= 8) {
      const out = {
        ok: true,
        txOnly: true,
        transactionSig,
        note: 'Scan por transactionSig aceito (MVP). Mint real será resolvido na Fase 4.',
        network,
        ts: nowIso()
      };
      res.status(200).send(JSON.stringify(out));
      return;
    }

    // Validação do mint
    if (!mint) {
      res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: 400, message: 'Campo "mint" (ou alias "tokenMint") é obrigatório' }
      }));
      return;
    }

    if (mint.length < 32) {
      res.status(400).send(JSON.stringify({
        ok: false,
        error: { code: 400, message: 'mint inválido — mínimo de 32 caracteres' }
      }));
      return;
    }

    // Consulta Bags (resiliente; _bags.js já garante tried[] SEMPRE no v0.3.8+)
    const bagsResp = await getBagsTokenInfo({ mint, network });

    // Traduz JSON da Bags em "hints" pro motor
    const hints = bagsResp.ok ? hintsFromBags(bagsResp.raw) : {};

    // Avalia risco
    let risk = evaluateRisk(hints);

    // Fallback amigável quando temos poucos sinais (mantém compat com respostas anteriores SAFE 25)
    const hintKeys = Object.keys(hints);
    if (hintKeys.length === 0) {
      // Força "liquidity_unknown" (+5) e "insufficient_data" (+20) para chegar a 25 SAFE
      risk = {
        score: 25,
        decision: 'safe',
        reason: 'Sem sinais relevantes de risco',
        risk: {
          level: 'safe',
          badge: riskBadge('safe'),
          factors: [
            { key: 'liquidity_unknown', score: 5, detail: 'Status de liquidez desconhecido' },
            { key: 'insufficient_data', score: 20, detail: 'Poucos sinais disponíveis' }
          ]
        }
      };
    }

    // Monta resposta final
    const out = {
      ok: true,
      id: genId('bsr'),
      decision: risk.decision,
      reason: risk.reason,
      score: risk.score,
      risk: risk.risk,
      network,
      tokenMint: mint,
      transactionSig: null,
      requestedBy,
      ts: nowIso(),
      bags: {
        ok: !!bagsResp.ok,
        base: bagsResp.base,
        status: bagsResp.status,
        rateLimit: bagsResp.rateLimit,
        tried: bagsResp.tried || [],
        raw: bagsResp.ok ? (bagsResp.raw || {}) : undefined,
        // opcional: expõe alguns "hints" que vieram da Bags (apenas chave/valor simples)
        hints: hintKeys.length ? hints : undefined
      }
    };

    res.status(200).send(JSON.stringify(out));
  } catch (err) {
    // Nunca deixa estourar: converte em 200 com ok:false
    const message = (err && err.message) ? String(err.message) : 'unexpected_error';
    res.status(200).send(JSON.stringify({
      ok: false,
      error: { code: 500, message },
      ts: nowIso()
    }));
  }
}
