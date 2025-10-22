
/* --- BEGIN readJsonRobust (injetado v2) --- */
type _IMsg = import('node:http').IncomingMessage;

function _collectBodyLegacy(req: _IMsg): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    // Alguns ambientes n?o exp?em req como async-iterable de forma est?vel; usar eventos ? mais port?til.
    (req as any).on('data', (c: any) => {
      try { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); } catch (e) { reject(e); }
    });
    (req as any).on('end', () => resolve(Buffer.concat(chunks)));
    (req as any).on('error', reject);
    (req as any).on('aborted', () => reject(new Error('request aborted')));
  });
}

export async function readJsonRobust<T = any>(req: _IMsg): Promise<T|null> {
  try {
    const buf = await _collectBodyLegacy(req as any);
    if (!buf || buf.length === 0) return null;

    let txt = buf.toString('utf8');
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // strip BOM
    txt = txt.trim();

    const ct = String((req.headers && req.headers['content-type']) || '').toLowerCase();

    // JSON declarado ou que "parece" JSON
    if (ct.includes('application/json') || /^[\[{]/.test(txt)) {
      try { return JSON.parse(txt) as T; } catch {}
    }

    // x-www-form-urlencoded -> objeto raso
    if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(txt);
      const obj: Record<string, string> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj as any as T;
    }

    // Tentativa final de JSON mesmo sem header coerente
    try { return JSON.parse(txt) as T; } catch {}

    return null;
  } catch (e) {
    console.error('[readJsonRobust] error:', e);
    return null;
  }
}
/* --- END readJsonRobust (injetado v2) --- */
 ---
import type { IncomingMessage, ServerResponse } from 'node:http';

type Network = 'devnet' | 'mainnet';
type Action = 'flag' | 'unflag' | 'limit_trading' | 'freeze';

type ApplyPayload = {
  mint?: string;
  network?: Network;
  action?: Action | string;
  reason?: string;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
};

type Json = Record<string, unknown>;

function setCommonHeaders(res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res: ServerResponse, status: number, body: Json) {
  setCommonHeaders(res);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function allow(res: ServerResponse, methods: string) {
  res.setHeader('Allow', methods);
}

async function readJsonRobust<T = unknown>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function badRequest(res: ServerResponse, message: string) {
  return sendJson(res, 400, {
    ok: false,
    error: { code: 'BAD_REQUEST', message },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}

function unauthorized(res: ServerResponse, message = 'Missing or invalid Authorization header') {
  return sendJson(res, 401, {
    ok: false,
    error: { code: 'UNAUTHORIZED', message },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}

function uid(prefix = 'act_') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${t}${r}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'POST').toUpperCase();

  if (method === 'OPTIONS') {
    setCommonHeaders(res);
    res.statusCode = 204;
    return res.end();
  }

  if (method !== 'POST') {
    allow(res, 'POST, OPTIONS');
    return sendJson(res, 405, {
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' },
      meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
    });
  }

  // Auth mínima
  const auth = (req.headers['authorization'] || '').toString();
  if (!auth.startsWith('Bearer ') || auth.trim().length <= 'Bearer '.length) {
    return unauthorized(res);
  }

  const body = await readJsonRobust<ApplyPayload>(req);
  if (!body) return badRequest(res, 'JSON body obrigatório');

  const mint = (body.mint || '').trim();
  const network = (body.network || process.env.BAGS_ENV || 'devnet') as Network;
  const action = (body.action || '').trim().toLowerCase() as Action;
  const reason = (body.reason || '').trim();
  const params = (body.params && typeof body.params === 'object') ? body.params : {};
  const idempotencyKey = (body.idempotencyKey || '').trim() || null;

  if (!mint) return badRequest(res, "Campo 'mint' é obrigatório");
  if (!['devnet', 'mainnet'].includes(network)) return badRequest(res, "Campo 'network' deve ser 'devnet' ou 'mainnet'");
  if (!action) return badRequest(res, "Campo 'action' é obrigatório");
  if (!['flag', 'unflag', 'limit_trading', 'freeze'].includes(action)) {
    return badRequest(res, "Campo 'action' inválido. Use 'flag', 'unflag', 'limit_trading' ou 'freeze'");
  }
  if (action === 'flag' && !reason) {
    return badRequest(res, "Campo 'reason' é obrigatório quando 'action' = 'flag'");
  }

  // Efeitos aplicados (placeholder local coerente com DOCUMENTOS BAGS)
  let effects: Record<string, unknown> = {};
  if (action === 'flag') {
    const severity = String((params as any).severity ?? 'medium').toLowerCase(); // low|medium|high
    effects = { state: 'flagged', severity };
  } else if (action === 'unflag') {
    effects = { state: 'normal' };
  } else if (action === 'limit_trading') {
    const limit = Number((params as any).limit ?? 0.5); // 0..1
    effects = { state: 'limited', limit: Math.max(0, Math.min(1, limit)) };
  } else if (action === 'freeze') {
    effects = { state: 'frozen' };
  }

  const id = uid();

  return sendJson(res, 200, {
    ok: true,
    data: {
      id,
      idempotencyKey,
      mint,
      network,
      action,
      reason: reason || null,
      params,
      result: 'applied',
      effects,
    },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}
