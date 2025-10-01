import type { IncomingMessage, ServerResponse } from 'node:http';

type ScanPayload = {
  mint?: string;
  network?: 'devnet' | 'mainnet';
  requestedBy?: string;
  tags?: string[];
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

function uid(prefix = 'bsr_') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${t}${r}`;
}

async function readJson<T = unknown>(req: IncomingMessage): Promise<T | null> {
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

  // Auth mínima (coerente com headers configurados no vercel.json)
  const auth = (req.headers['authorization'] || '').toString();
  if (!auth.startsWith('Bearer ') || auth.trim().length <= 'Bearer '.length) {
    return unauthorized(res);
  }

  const body = await readJson<ScanPayload>(req);
  if (!body) return badRequest(res, 'JSON body obrigatório');

  const mint = (body.mint || '').trim();
  const network = (body.network || process.env.BAGS_ENV || 'devnet') as 'devnet' | 'mainnet';
  const requestedBy = (body.requestedBy || '').trim();
  const tags = Array.isArray(body.tags) ? body.tags.slice(0, 16) : [];

  if (!mint) return badRequest(res, "Campo 'mint' é obrigatório");
  if (!['devnet', 'mainnet'].includes(network)) return badRequest(res, "Campo 'network' deve ser 'devnet' ou 'mainnet'");

  const id = uid();

  // Resposta padronizada (enfileirado para análise – decisão será feita por processadores downstream)
  return sendJson(res, 201, {
    ok: true,
    data: {
      id,
      status: 'queued',
      mint,
      network,
      requestedBy: requestedBy || null,
      tags,
      decision: 'pending',
      reason: null,
    },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}

