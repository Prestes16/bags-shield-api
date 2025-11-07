import type { VercelRequest, VercelResponse } from "@vercel/node";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}
function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}
function newRequestId(): string {
  return "req_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res); noStore(res);
  const rid = newRequestId();
  res.setHeader("X-Request-Id", rid);

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed", meta: { requestId: rid }});
    return;
  }

  const apiKey = (process.env.BAGS_API_KEY ?? "").trim();
  const apiBase = (process.env.BAGS_API_BASE ?? "").trim();
  const timeout = (process.env.BAGS_TIMEOUT_MS ?? "").trim();

  const response = {
    hasApiKey: apiKey.length > 0,
    apiBaseSet: apiBase.length > 0,
    timeoutMs: timeout ? Number(timeout) : null,

    // Infos de runtime/implantação (úteis p/ suporte)
    node: process.version,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    region: process.env.VERCEL_REGION ?? null,

    // Como esperamos autenticar chamadas upstream (sem vazar valores)
    expectedAuthHeaders: {
      "x-api-key": apiKey.length > 0 ? "<present>" : null,
      "authorization": apiKey.length > 0 ? "Bearer <redacted>" : null
    }
  };

  res.status(200).json({ success: true, response, meta: { requestId: rid } });
}