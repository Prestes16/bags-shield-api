import type { VercelRequest, VercelResponse } from '@vercel/node';
import core from './core.js';

type Issue = { path: string; message: string };
type ErrorBody = { code: string; message: string; issues?: Issue[] };
type Ok<T> = { success: true; response: T };
type Err = { success: false; error: ErrorBody };

function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function send<T>(res: VercelResponse, status: number, body: Ok<T> | Err) {
  noStore(res);
  res.status(status).json(body as any);
}

function methodNotAllowed(res: VercelResponse, allow: string[] = ['POST','OPTIONS']) {
  res.setHeader('Allow', allow.join(', '));
  send(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${allow.join(' | ')}` }});
}

function unauthorized(res: VercelResponse, message = 'Missing or invalid Authorization: Bearer <token>') {
  send(res, 401, { success: false, error: { code: 'UNAUTHORIZED', message }});
}

function firstString(x: unknown): string | undefined {
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return typeof x[0] === 'string' ? x[0] as string : undefined;
  return undefined;
}

function safeStartsWith(s: unknown, prefix: string): boolean {
  return typeof s === 'string' && s.startsWith(prefix);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Pré-flight simples; CORS completo entra depois
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const auth = firstString(req.headers['authorization']);
  if (!safeStartsWith(auth, 'Bearer ')) {
    unauthorized(res);
    return;
  }

  try {
    await core(req, res);
  } catch (e: any) {
    console.error('simulate/core error:', e);
    send(res, 500, { success: false, error: { code: 'INTERNAL', message: e?.message ?? 'Internal error' }});
  }
}