import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
      res.statusCode = 204; res.end(); return;
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success:false, error:'Method Not Allowed' }));
      return;
    }
    const rid = 'req_' + Math.random().toString(36).slice(2);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
    res.setHeader('X-Request-Id', rid);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 200;
    res.end(JSON.stringify({ success:true, response:{ message:'pong' }, meta:{ requestId: rid, ts: Date.now() } }));
  } catch (e: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success:false, error:String(e?.message ?? e) }));
  }
}