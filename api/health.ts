// api/health.ts
import type { IncomingMessage, ServerResponse } from 'node:http';

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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();

  // Preflight simples (coordenado com vercel.json)
  if (method === 'OPTIONS') {
    setCommonHeaders(res);
    res.statusCode = 204;
    return res.end();
  }

  if (method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  return sendJson(res, 200, {
    ok: true,
    service: 'bags-shield-api',
    version: '1.0.0',
    status: 'healthy',
    time: new Date().toISOString(),
  });
}


