/**
 * /api/scan — Vercel Node Function (JS)
 * Tenta req.body (com try/catch) e faz fallback para stream.
 */
const allowCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,X-Bags-API-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
};

async function readJsonFromStream(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw.length ? raw : null;
}

function tryGetBody(req) {
  // Alguns runtimes expõem getter que lança se JSON inválido.
  try {
    if (typeof req.body === "undefined" || req.body === null) return null;
    const b = req.body;
    if (typeof b === "string") { try { return JSON.parse(b); } catch { return null; } }
    if (Buffer.isBuffer(b))     { try { return JSON.parse(b.toString("utf8")); } catch { return null; } }
    if (typeof b === "object")  { return b; }
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    allowCors(res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST,OPTIONS");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" },
        meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
      }));
    }

    const auth = req.headers?.authorization || req.headers?.["x-bags-api-key"];
    if (!auth || (typeof auth === "string" && !auth.toLowerCase().startsWith("bearer "))) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" },
        meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
      }));
    }

    // 1) Tenta req.body
    let payload = tryGetBody(req);

    // 2) Se não veio, lê da stream
    if (!payload) {
      const raw = await readJsonFromStream(req);
      if (!raw) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({
          ok: false,
          error: { code: "BAD_REQUEST", message: "JSON body obrigatório" },
          meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
        }));
      }
      try {
        payload = JSON.parse(raw);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({
          ok: false,
          error: { code: "BAD_REQUEST", message: "JSON inválido" },
          meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
        }));
      }
    }

    const { mint, network, requestedBy, tags } = payload || {};
    if (!mint || !network) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({
        ok: false,
        error: { code: "BAD_REQUEST", message: "Campos obrigatórios: mint, network" },
        meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
      }));
    }

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({
      ok: true,
      data: {
        taskId: `demo-${Date.now()}`,
        received: { mint, network, requestedBy, tags }
      },
      meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
    }));
  } catch (err) {
    console.error("[/api/scan] Uncaught error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected error" },
      meta: { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString() }
    }));
  }
}

