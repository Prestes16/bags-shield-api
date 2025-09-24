// api/scan.js
import { z } from 'zod';
import {
  ScanBaseSchema,
  computeRiskFactors,
  buildResponse,
  readJson,
  sendJson
} from './_utils.js';

// Usamos a BASE (sem transform) para poder .extend()
const BodySchema = ScanBaseSchema
  .extend({
    mock: z.record(z.any()).optional()
  })
  .transform((data) => ({
    ...data,
    mint: data.mint ?? data.tokenMint ?? undefined
  }))
  .refine((data) => data.mint || data.transactionSig, {
    message: 'Forneça mint/tokenMint ou transactionSig.'
  });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Use POST' });
  }

  try {
    const raw = await readJson(req);
    const body = BodySchema.parse(raw);

    // MVP: aceitar transactionSig sem mint → resposta parcial
    if (!body.mint && body.transactionSig) {
      return sendJson(res, 201, {
        ok: true,
        txOnly: true,
        transactionSig: body.transactionSig,
        note: 'Scan por transactionSig aceito (MVP). Mint real será resolvido na Fase 4.',
        network: body.network,
        ts: new Date().toISOString()
      });
    }

    const risk = computeRiskFactors(body);

    const decision =
      risk.total >= 80 ? 'block' :
      risk.total >= 60 ? 'flag'  :
      risk.total >= 30 ? 'warn'  :
                         'safe';

    const reason =
      decision === 'block' ? 'Risco crítico detectado' :
      decision === 'flag'  ? 'Fatores de alto risco identificados' :
      decision === 'warn'  ? 'Atenção: riscos moderados' :
                             'Sem sinais relevantes de risco';

    const resp = buildResponse({
      id: `bsr_${Math.random().toString(36).slice(2, 10)}`,
      decision,
      reason,
      input: body,
      risk
    });

    return sendJson(res, 201, resp);
  } catch (err) {
    console.error('scan_error', err);
    return sendJson(res, 400, { ok: false, error: String(err?.message || err) });
  }
}
