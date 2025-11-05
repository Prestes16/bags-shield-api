import type { VercelRequest, VercelResponse } from '@vercel/node';

const rid = () => 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const r = rid();
  res.setHeader('X-Request-Id', r);
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success:false, error:'Method Not Allowed', meta:{ requestId: r }});
  }

  const base = process.env.BAGS_API_BASE ?? null;
  const payload = {
    success: true,
    env: {
      BAGS_API_BASE: base,
      VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    meta: { requestId: r, note: 'Somente valores não sensíveis.' }
  };

  return res.status(200).json(payload);
}