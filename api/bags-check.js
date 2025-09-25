// api/bags-check.js
import { sendJson } from './_utils.js';

function pickRateLimit(headers) {
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const out = {};
  if (remaining != null) out.remaining = Number(remaining);
  if (reset != null) out.reset = reset;
  return Object.keys(out).length ? out : undefined;
}

export default async function handler(req, res) {
  const hasKey = !!process.env.BAGS_API_KEY;
  const bases = (process.env.BAGS_API_BASE || 'https://public-api-v2.bags.fm')
    .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);

  const statusPaths = (process.env.BAGS_API_STATUS_PATHS || '/ping,/api/v1/ping,/status,/api/v1/status,/health,/api/v1/health')
    .split(',').map(s => s.trim()).filter(Boolean);

  const attempts = [];
  for (const base of bases) {
    for (const path of statusPaths) {
      const url = base + path;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4000);
        const headers = { 'Accept': 'application/json' };
        if (hasKey) {
          const mode = (process.env.BAGS_AUTH_MODE || 'header').toLowerCase();
          if (mode === 'header') {
            const h = process.env.BAGS_AUTH_HEADER || 'x-api-key';
            headers[h] = process.env.BAGS_API_KEY;
          } else {
            headers['Authorization'] = `Bearer ${process.env.BAGS_API_KEY}`;
          }
        }
        const r = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        clearTimeout(t);
        attempts.push({
          base, path, status: r.status, ok: r.ok, rateLimit: pickRateLimit(r.headers)
        });
      } catch (e) {
        attempts.push({ base, path, ok: false, error: String(e?.message || e) });
      }
    }
  }

  const reachable = attempts.some(a => a.ok || (a.status && a.status >= 200 && a.status < 500));
  return sendJson(res, 200, { ok: true, hasKey, bases, statusPaths, reachable, attempts });
}
