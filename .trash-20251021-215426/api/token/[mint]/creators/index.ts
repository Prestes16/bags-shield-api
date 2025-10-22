import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, preflight } from '../../../../lib/cors.js';
import core from './core.js';

type ErrorBody = { code: string; message: string };
type Ok<T> = { success: true; response: T };
type Err = { success: false; error: ErrorBody };

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
function isValidMint(x: unknown): boolean {
  const s = typeof x === 'string' ? x : String(x ?? '');
  return BASE58_RE.test(s) && s.length >= 32 && s.length <= 44;
}

function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function send<T>(res: VercelResponse, status: number, body: Ok<T> | Err) {
  noStore(res);
  applyCors(({} as any), res); // garante CORS mesmo em erros
  res.status(status).json(body as any);
}

function methodNotAllowed(res: VercelResponse, allow: string[] = ['GET','OPTIONS']) {
  res.setHeader('Allow', allow.join(', '));
  send(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${allow.join(' | ')}` } });
}

function badRequest(res: VercelResponse, msg: string) {
  send(res, 400, { success: false, error: { code: 'BAD_MINT', message: msg } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    preflight(req, res);
    return;
  }

  if (req.method !== 'GET') {
    applyCors(req, res);
    methodNotAllowed(res);
    return;
  }

  const mint = (req as any)?.query?.mint;
  if (!isValidMint(mint)) {
    applyCors(req, res);
    badRequest(res, 'Parâmetro :mint inválido (Base58 32–44 chars)');
    return;
  }

  try {
    applyCors(req, res);
    noStore(res);
    const data = await core(req); // retorna { mint, creators: [...] }
    res.status(200).json({ success: true, response: data } satisfies Ok<any>);
  } catch (e: any) {
    console.error('token/creators/core error:', e);
    applyCors(req, res);
    send(res, 500, { success: false, error: { code: 'INTERNAL', message: e?.message ?? 'Internal error' } });
  }
}