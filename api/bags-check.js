// api/bags-check.js
import { sendJson } from './_utils.js';

export default async function handler(req, res) {
  // não expõe segredo, só mostra se existe e se a base responde
  const hasKey = !!process.env.BAGS_API_KEY;
  const bases = (process.env.BAGS_API_BASE || 'https://api.bags.app')
    .split(',').map(s => s.trim()).filter(Boolean);

  const candidates = ['/v1/status', '/status', '/v1/health', '/health'];
  const attempts = [];

  for (const base of bases) {
    for (const path of candidates) {
      const url = base.replace(/\/+$/, '') + path;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4000);
        const r = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...(hasKey ? { 'Authorization': `Bearer ${process.env.BAGS_API_KEY}` } : {})
          },
          signal: controller.signal
        });
        clearTimeout(t);
        attempts.push({ base, path, status: r.status, ok: r.ok });
        // não precisamos ler o body
      } catch (e) {
        attempts.push({ base, path, ok: false, error: String(e?.message || e) });
      }
    }
  }

  const reachable = attempts.some(a => a.ok || (a.status && a.status >= 200 && a.status < 500));
  return sendJson(res, 200, {
    ok: true,
    hasKey,
    bases,
    reachable,
    attempts
  });
}
