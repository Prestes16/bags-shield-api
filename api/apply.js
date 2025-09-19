import { created, badRequest, notAllowed, serverError } from '../lib/responses.js';
import { requireFields } from '../lib/validation.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return notAllowed(res, ['POST']);

    const { mint, decision, reason, requestedBy } = req.body || {};
    const check = requireFields({ mint, decision }, { mint: 'string', decision: 'string' });
    if (!check.valid) return badRequest(res, 'Campos inválidos', check.errors);

    const allowed = ['approve', 'reject', 'flag'];
    const d = String(decision).toLowerCase();
    if (!allowed.includes(d)) {
      return badRequest(res, 'decision deve ser approve|reject|flag');
    }

    // MVP: sem DB — apenas retorna um “pedido” criado (queued)
    const id = `bsr_${Date.now().toString(36)}`;
    return created(res, {
      id,
      status: 'queued',
      mint,
      decision: d,
      reason: reason || null,
      requestedBy: requestedBy || 'system',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    return serverError(res, err);
  }
}

