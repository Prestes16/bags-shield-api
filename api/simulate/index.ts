// api/simulate.ts
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

function methodNotAllowed(res: VercelResponse, allow: string[] = ['POST', 'OPTIONS']) {
  res.setHeader('Allow', allow.join(', '));
  send(res, 405, {
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${allow.join(' | ')}` },
  });
}

function badRequest(res: VercelResponse, error: ErrorBody) {
  send(res, 400, { success: false, error });
}

function ok<T>(res: VercelResponse, response: T) {
  send(res, 200, { success: true, response });
}

// Parse seguro que não lança exceção; retorna { ok, value?, issues? }
function safeParseJson(input: unknown): { ok: true; value: any } | { ok: false; issues: Issue[] } {
  // Se já veio objeto (Next/Vercel muitas vezes já parseiam):
  if (input && typeof input === 'object' && !Buffer.isBuffer(input)) {
    return { ok: true, value: input };
  }

  // Buffer -> string
  if (Buffer.isBuffer(input)) {
    const raw = input.toString('utf8');
    try {
      return { ok: true, value: raw.length ? JSON.parse(raw) : {} };
    } catch (e: any) {
      return {
        ok: false,
        issues: [{ path: '$', message: `Invalid JSON: ${e?.message ?? 'parse error'}` }],
      };
    }
  }

  // string ou vazio
  if (typeof input === 'string') {
    const raw = input.trim();
    if (raw.length === 0) return { ok: true, value: {} };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (e: any) {
      return {
        ok: false,
        issues: [{ path: '$', message: `Invalid JSON: ${e?.message ?? 'parse error'}` }],
      };
    }
  }

  // Sem corpo => objeto vazio
  return { ok: true, value: {} };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Pré-flight simples (CORS detalhado entra no próximo passo)
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  // Parse tolerante
  const parsed = safeParseJson(req.body);

  if (!parsed.ok) {
    badRequest(res, {
      code: 'BAD_JSON',
      message: 'Corpo da requisição não é um JSON válido.',
      issues: parsed.issues,
    });
    return;
  }

  const payload = parsed.value ?? {};

  // Aqui manteremos um "eco" mínimo para não quebrar callers existentes.
  // A lógica real de simulação entra nas próximas etapas do plano.
  ok(res, {
    note: 'simulate-ok',
    received: payload,
  });
}
