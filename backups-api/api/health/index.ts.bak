export const config = { runtime: "nodejs" };

export default async function handler(req: any, res: any) {
  const id = (globalThis.crypto && "randomUUID" in globalThis.crypto) ?
    globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);

  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  res.setHeader("X-Request-Id", id);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (String(req.method).toUpperCase() === "HEAD") {
    res.status(200).end();
    return;
  }
  const body = {
    ok: true,
    status: "healthy",
    meta: { service: "bags-shield-api", version: "1.0.0", env: "production", time: new Date().toISOString(), requestId: id },
    checks: { uptimeSeconds: 1 }
  };
  res.status(200).send(JSON.stringify(body));
}
