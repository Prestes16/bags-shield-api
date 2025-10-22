import type { VercelRequest, VercelResponse } from '@vercel/node';

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

function badRequest(res: VercelResponse, error: ErrorBody) {
  send(res, 400, { success: false, error });
}

function ok<T>(res: VercelResponse, response: T) {
  send(res, 200, { success: true, response });
}

// Parse seguro que não lança exceção; retorna { ok, value?, issues? }
function safeParseJson(input: unknown): { ok: true; value: any } | { ok: false; issues: Issue[] } {
  if (input && typeof input === 'object' && !Buffer.isBuffer(input)) {
    return { ok: true, value: input };
  }
  if (Buffer.isBuffer(input)) {
    const raw = input.toString('utf8');
    try {
      return { ok: true, value: raw.length ? JSON.parse(raw) : {} };
    } catch (e: any) {
      return { ok: false, issues: [{ path: '$', message: `Invalid JSON: ${e?.message ?? 'parse error'}` }] };
    }
  }
  if (typeof input === 'string') {
    const raw = input.trim();
    if (raw.length === 0) return { ok: true, value: {} };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (e: any) {
      return { ok: false, issues: [{ path: '$', message: `Invalid JSON: ${e?.message ?? 'parse error'}` }] };
    }
  }
  return { ok: true, value: {} };
}

// Evita que o getter req.body da Vercel lance antes da nossa validação
function tryGetBody(req: VercelRequest): { ok: true; value: any } | { ok: false; message: string } {
  try {
    const v: any = (req as any).body;
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Invalid JSON' };
  }
}

// Core de /api/simulate: assume auth/método já validados no index.ts
async function core(req: VercelRequest, res: VercelResponse) {
  const got = tryGetBody(req);
  if (!got.ok) {
    badRequest(res, {
      code: 'BAD_JSON',
      message: 'Corpo da requisição não é um JSON válido.',
      issues: [{ path: '$', message: `Invalid JSON (dev server): ${got.message}` }],
    });
    return;
  }

  const parsed = safeParseJson(got.value);
  if (!parsed.ok) {
    badRequest(res, {
      code: 'BAD_JSON',
      message: 'Corpo da requisição não é um JSON válido.',
      issues: parsed.issues,
    });
    return;
  }

  const payload = parsed.value ?? {};
  ok(res, { note: 'simulate-ok', received: payload });
}

export default core;
export { core };