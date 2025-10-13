/** Utils comuns (ID de requisição, ETag, log, cache helpers) */
export function reqId() {
  try {
    return (globalThis.crypto?.randomUUID?.() ?? null) || Math.random().toString(36).slice(2) + Date.now().toString(36);
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export function computeEtag(obj) {
  try {
    const s = JSON.stringify(obj, Object.keys(obj).sort());
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return `W/"${(h >>> 0).toString(16)}-${s.length}"`;
  } catch {
    return undefined;
  }
}

/** Aplica ETag e, se o cliente enviar If-None-Match igual, responde 304 e encerra. */
export function applyEtag(req, res, payload) {
  const etag = computeEtag(payload);
  if (etag) res.setHeader('ETag', etag);
  const inm = (req?.headers?.['if-none-match'] || '').toString();
  if (String(req?.method || '').toUpperCase() === 'GET' && inm && etag && inm === etag) {
    res.status(304).end();
    return true; // já respondeu
  }
  return false; // siga o fluxo normal
}

/** Cache para revalidação sempre (permite 304): não guarda sem revalidar. */
export function cacheNoCache(res) {
  res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/** Log mínimo estruturado */
export function logReq(id, req, extra = {}) {
  try {
    const method = String(req?.method || '');
    const url = String(req?.url || '');
    const ip = (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString();
    const line = JSON.stringify({ t: new Date().toISOString(), id, method, url, ip, ...extra });
    // eslint-disable-next-line no-console
    console.log(line);
  } catch {
    // ignore
  }
}
