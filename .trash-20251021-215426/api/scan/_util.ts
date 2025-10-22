import type { VercelRequest, VercelResponse } from "@vercel/node";
export function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
}
export function preflight(_req: VercelRequest, res: VercelResponse) { setCors(res); res.status(204).end(); }
export function noStore(res: VercelResponse) { res.setHeader("Cache-Control", "no-store"); }