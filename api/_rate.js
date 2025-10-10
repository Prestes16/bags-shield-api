/** Rate limit simples (por IP), janela fixa, com fallback para arquivo .rate-store.json.
 *  Config por env:
 *   - RATE_MAX (padrão: 60 req)
 *   - RATE_WINDOW_MS (padrão: 60000 ms = 1 min)
 *   - RATE_STORE_FILE (padrão: .rate-store.json)
 *  Headers:
 *   - X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After(429)
 */
const DEFAULT_WINDOW = Number(process.env.RATE_WINDOW_MS || 60000);
const DEFAULT_MAX = Number(process.env.RATE_MAX || 60);
const STORE_FILE = (process.env.RATE_STORE_FILE || '.rate-store.json').trim();

// in-memory (mesmo processo)
const MEM = (globalThis.__RATE_MEM__ ||= new Map());

function keyParts(key) {
  const idx = key.lastIndexOf(':');
  return { ip: key.slice(0, idx), bucket: Number(key.slice(idx + 1)) };
}

async function loadFile() {
  try {
    const fs = await import('node:fs/promises');
    const s = await fs.readFile(STORE_FILE, 'utf8');
    const obj = JSON.parse(s || '{}');
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

async function saveFile(obj) {
  try {
    const fs = await import('node:fs/promises');
    await fs.writeFile(STORE_FILE, JSON.stringify(obj), 'utf8');
  } catch {
    // ignore falhas de disco em dev
  }
}

export async function rateLimit(req, res, opts = {}) {
  const windowMs = Number(opts.windowMs ?? DEFAULT_WINDOW);
  const max = Number(opts.max ?? DEFAULT_MAX);
  const now = Date.now();

  // IP do cliente (x-forwarded-for > socket)
  const ipRaw = (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown').toString();
  const ip = ipRaw.split(',')[0].trim();

  // Janela fixa: chave por IP + bucket (floor(now/windowMs))
  const bucket = Math.floor(now / windowMs);
  const key = `${ip}:${bucket}`;

  // 1) tenta memória do processo
  let count = (MEM.get(key) || 0) + 1;
  MEM.set(key, count);

  // 2) tenta também arquivo (para quando cada request cai em processo diferente)
  const FILE = await loadFile();
  FILE[key] = (FILE[key] || 0) + 1;
  count = Math.max(count, FILE[key]); // usa o pior caso (maior contagem)

  // limpeza de buckets antigos no arquivo
  const cutoff = now - windowMs * 2;
  for (const k of Object.keys(FILE)) {
    const { bucket: b } = keyParts(k);
    const start = b * windowMs;
    if (start < cutoff) delete FILE[k];
  }
  // escreve de volta (best-effort)
  await saveFile(FILE);

  const remaining = Math.max(0, max - count);
  const resetUnix = Math.ceil(((bucket + 1) * windowMs) / 1000); // em segundos

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetUnix));

  if (count > max) {
    const retryAfter = Math.ceil(((bucket + 1) * windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ ok: false, error: 'Too Many Requests' });
    return { ok: false, ip, remaining, reset: resetUnix, limit: max };
  }

  return { ok: true, ip, remaining, reset: resetUnix, limit: max };
}

