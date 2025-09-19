import { ok, badRequest, notAllowed, serverError } from '../lib/responses.js';
import { requireFields, isBoolean } from '../lib/validation.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return notAllowed(res, ['POST']);

    const body = req.body || {};
    const schema = { supply: 'number', decimals: 'number' };
    const check = requireFields(body, schema);
    if (!check.valid) return badRequest(res, 'Campos inválidos', check.errors);

    const supply = Number(body.supply);
    const decimals = Number(body.decimals);
    const hasFreezeAuthority = isBoolean(body.hasFreezeAuthority) ? body.hasFreezeAuthority : false;
    const hasMintAuthority = isBoolean(body.hasMintAuthority) ? body.hasMintAuthority : false;

    // Opção A: fee on-chain em SOL (regras MVP)
    let feeSol = 0.02; // base
    if (supply > 1_000_000_000) feeSol += 0.01;
    if (decimals > 6) feeSol += 0.005;
    if (hasFreezeAuthority) feeSol += 0.005;
    if (hasMintAuthority) feeSol += 0.0075;

    // Arredonda a 6 casas (µSOL)
    feeSol = Math.round(feeSol * 1e6) / 1e6;

    const breakdown = [
      { label: 'Base', value: 0.02 },
      { label: 'Supply', value: supply > 1_000_000_000 ? 0.01 : 0 },
      { label: 'Decimals', value: decimals > 6 ? 0.005 : 0 },
      { label: 'FreezeAuthority', value: hasFreezeAuthority ? 0.005 : 0 },
      { label: 'MintAuthority', value: hasMintAuthority ? 0.0075 : 0 }
    ];

    return ok(res, {
      network: process.env.SOLANA_NETWORK || 'devnet',
      estimatedFeeSol: feeSol,
      breakdown,
      message: 'Simulação concluída (MVP) — ajuste as regras conforme negócio.'
    });
  } catch (err) {
    return serverError(res, err);
  }
}

