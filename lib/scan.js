import { ok, badRequest, notAllowed, serverError } from '../lib/responses.js';
import { requireFields } from '../lib/validation.js';
import { computeRisk } from '../lib/risk.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return notAllowed(res, ['POST']);

    const { mint, metadata = {}, context = {} } = req.body || {};

    const check = requireFields({ mint }, { mint: 'string' });
    if (!check.valid) return badRequest(res, 'Campos inválidos', check.errors);

    // Futuro: enriquecer metadata via Bags API / Solana RPC.
    const result = computeRisk({ mint, metadata, context });

    return ok(res, { mint, ...result });
  } catch (err) {
    return serverError(res, err);
  }
}

