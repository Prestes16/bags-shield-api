// api/simulate.js
import { z } from 'zod';
import {
  ScanInputSchema,
  computeRiskFactors,
  buildResponse,
  readJson,
  sendJson
} from './_utils.js';

// Simulate exige o bloco mock (para testar cenários)
const BodySchema = ScanInputSchema.extend({
  mock: z.object({
    mintAuthorityActive: z.boolean().optional(),
    top10HoldersPct: z.number().min(0).max(100).optional(),
    freezeNotRenounced: z.boolean().optional(),
    tokenAgeDays: z.number().min(0).optional(),
    liquidityLocked: z.boolean().optional(),
    creatorReputation: z.number().min(0).max(100).optional()
  })
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Use POST' });
  }

  try {
    const raw = await readJson(req);
    const normalized = {
      ...raw,
      mint: raw?.mint ?? raw?.tokenMint ?? undefined
    };

    const body = BodySchema.parse(normalized);
    const risk = computeRiskFactors(body);

    const decision =
      risk.total >= 80 ? 'block' :
      risk.total >= 60 ? 'flag'  :
      risk.total >= 30 ? 'warn'  :
                         'safe';

    const reason = 'Simulação de decisão de risco com base nos parâmetros mockados';

    const resp = buildResponse({
      id: `bss_${Math.random().toString(36).slice(2, 10)}`,
      decision,
      reason,
      input: body,
      risk
    });

    return sendJson(res, 201, resp);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: String(err?.message || err) });
  }
}
