/** CORS helpers (JS) + security headers + múltiplas origens */
export function setCors(
  res,
  origin = "*",
  methods = ["GET", "POST", "OPTIONS"],
  headers = ["Content-Type", "Authorization", "X-Requested-With"],
  req /* opcional */
) {
  const raw = (process.env.CORS_ALLOW || "").trim();
  let allowOrigin = origin;

  if (raw) {
    const list = raw.split(",").map(s => s.trim()).filter(Boolean);
    if (list.includes("*")) {
      allowOrigin = "*";
    } else {
      const reqOrigin = (req?.headers?.origin || "").trim();
      if (reqOrigin && list.includes(reqOrigin)) {
        allowOrigin = reqOrigin; // espelha a origem quando ela é permitida
      } else {
        allowOrigin = list[0]; // fallback para a 1ª origem permitida
      }
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", headers.join(", "));
  res.setHeader("Access-Control-Max-Age", "86400");

  // Security hardening
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=()");
}

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

export function preflight(req, res) {
  if ((req.method || "").toUpperCase() === "OPTIONS") {
    setCors(res, "*", ["GET", "POST", "OPTIONS"], ["Content-Type", "Authorization", "X-Requested-With"], req);
    noStore(res);
    res.status(204).end();
    return true;
  }
  return false;
}

export function guardMethod(req, res, allowed) {
  const method = String(req.method || "GET").toUpperCase();
  if (!allowed.includes(method)) {
    setCors(res, "*", ["GET", "POST", "OPTIONS"], ["Content-Type", "Authorization", "X-Requested-With"], req);
    noStore(res);
    res.setHeader("Allow", allowed.join(", "));
    res.status(405).json({ ok: false, error: "Method Not Allowed", allow: allowed });
    return false;
  }
  return true;
}
