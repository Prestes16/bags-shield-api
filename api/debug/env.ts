export const config = { runtime: "nodejs" };
export default async function handler(req:any, res:any){
  const baseRaw = (process.env.BAGS_API_BASE ?? null);
  const baseOv  = (process.env.BAGS_API_BASE_OVERRIDE ?? null);
  const resolved = (() => {
    const raw = (baseOv ?? baseRaw ?? "").trim();
    if (!raw) return null;
    return raw.replace(/\/_mock\b/, "/mock").trim();
  })();
  const out = { ok:true, env: { BAGS_API_BASE: baseRaw, BAGS_API_BASE_OVERRIDE: baseOv, resolvedBase: resolved, BAGS_TIMEOUT_MS: process.env.BAGS_TIMEOUT_MS || null } };
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.status(200).send(JSON.stringify(out));
}
