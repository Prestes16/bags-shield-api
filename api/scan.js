// api/scan.js
import { z } from 'zod';
import {
  ScanInputSchema,
  computeRiskFactors,
  buildResponse,
  readJson,
  sendJson
} from './_utils.js';

// Mantemos o schema base e permitimos mocks opcionais
const BodySchema = ScanInputSchema.extend({
  mock: z.record(z.any()).optional()
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Use POST' });
  }

  try {
    // 🔧 Normalização: aceitar tanto "mint" quanto "tokenMint"
    const raw = await readJson(req);
    const normalized = {
      ...raw,
      mint: raw?.mint ?? raw?.tokenMint ?? undefined,
      tokenMint: raw?.tokenMint ?? raw?.mint ?? undefined
    };

    const body = BodySchema.parse(normalized);

    // MVP: permitir scan por transactionSig sem mint → resposta parcial
    if (!body.mint && body.transactionSig) {
      return sendJson(res, 201, {
        ok: true,
        txOnly: true,
        transactionSig: body.transactionSig,
        note:
          'Scan por transactionSig aceito (MVP). Mint real será resolvido na Fase 4.',
        network: body.network,
        ts: new Date().toISOString()
      });
    }

    // Engine de risco mockável (Fase 3)
    const risk = computeRiskFactors(body);

    // Decisão simples por score
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
    return sendJson(res, 400, { ok: false, error: err.message });
  }
}
