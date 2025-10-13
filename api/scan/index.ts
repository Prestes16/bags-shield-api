import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, preflight } from '../../lib/cors.js';
import core from './core.js';

type ErrorBody = { code: string; message: string };
type Ok<T> = { success: true; response: T };
type Err = { success: false; error: ErrorBody };

function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function send<T>(res: VercelResponse, status: number, body: Ok<T> | Err) {
  noStore(res);
  applyCors(({} as any), res); // garantimos os headers CORS mesmo em erros; origin será resolvido pelo helper
  res.status(status).json(body as any);
}

function methodNotAllowed(res: VercelResponse, allow: string[] = ['GET','OPTIONS']) {
  res.setHeader('Allow', allow.join(', '));
  send(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${allow.join(' | ')}` } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Preflight
  if (req.method === 'OPTIONS') {
    preflight(req, res);
    return;
  }

  if (req.method !== 'GET') {
    // 405 com CORS
    applyCors(req, res);
    methodNotAllowed(res);
    return;
  }

  try {
    const data = await core(req);
    applyCors(req, res);
    noStore(res);
    res.status(200).json({ success: true, response: data } satisfies Ok<any>);
  } catch (e: any) {
    console.error('scan/core error:', e);
    applyCors(req, res);
    send(res, 500, { success: false, error: { code: 'INTERNAL', message: e?.message ?? 'Internal error' } });
  }
}