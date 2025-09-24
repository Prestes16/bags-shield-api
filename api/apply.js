// api/apply.js
import { z } from 'zod';
import {
  ScanInputSchema,
  computeRiskFactors,
  buildResponse,
  readJson,
  sendJson
} from './_utils.js';

// MVP: aplica decisão e sugere ações
const BodySchema = ScanInputSchema.extend({
  mock: z.record(z.any()).optional()
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

    const actions = decision === 'block' ? [
      { type: 'deny_transaction', reason: 'score >= 80' },
      { type: 'alert_user', message: 'Risco crítico — transação bloqueada.' }
    ] : decision === 'flag' ? [
      { type: 'require_extra_confirmation', message: 'Confirme que entende os riscos (holders concentrados, etc.)' },
      { type: 'suggest_liquidity_lock', message: 'Bloqueie liquidez antes de prosseguir.' }
    ] : decision === 'warn' ? [
      { type: 'show_disclaimer', message: 'Riscos moderados — prossiga com cautela.' }
    ] : [
      { type: 'allow', message: 'Seguro dentro dos parâmetros.' }
    ];

    const resp = {
      ...buildResponse({
        id: `bsa_${Math.random().toString(36).slice(2, 10)}`,
        decision,
        reason: 'Decisão aplicada (MVP: somente sugestão de ações)',
        input: body,
        risk
      }),
      actions
    };

    return sendJson(res, 201, resp);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: String(err?.message || err) });
  }
}
