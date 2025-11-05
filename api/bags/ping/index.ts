import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bagsFetch } from '../../../lib/bags'; // Assumindo que este caminho está correto

function requestId() {
  return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const rid = requestId();
  res.setHeader('X-Request-Id', rid);
  res.setHeader('Cache-Control', 'no-store'); // Header padrão do projeto
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  res.setHeader('Access-Control-Allow-Origin', '*'); // CORS unificado

  try {
    const { data, res: upstream } = await bagsFetch<{ message: string }>('ping', { method: 'GET' });
    return res.status(200).json({ success: true, response: data, meta: { requestId: rid, rate: {
      limit: upstream.headers.get('X-RateLimit-Limit'),
      remaining: upstream.headers.get('X-RateLimit-Remaining'),
      reset: upstream.headers.get('X-RateLimit-Reset'),
    } } });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return res.status(status).json({ success: false, error: String(e?.message ?? 'unknown_error'), meta: { requestId: rid } });
  }
}