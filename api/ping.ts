import type { VercelRequest, VercelResponse } from '@vercel/node';
export const config = { runtime: 'nodejs20.x' };
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({ success: true, response: { message: 'pong' }, meta: { ts: Date.now() } });
}