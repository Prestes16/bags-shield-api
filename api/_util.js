/** Utils comuns (ID de requisição, ETag e log) */
export function reqId() {
  try {
    // Node 20+: crypto.randomUUID()
    return (globalThis.crypto?.randomUUID?.() ?? null) || Math.random().toString(36).slice(2) + Date.now().toString(36);
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export function computeEtag(obj) {
  // hash leve e estável do payload (sem depender de order de keys)
  try {
    const s = JSON.stringify(obj, Object.keys(obj).sort());
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    // etag fraca (suficiente p/ debug)
    return `W/"${(h >>> 0).toString(16)}-${s.length}"`;
  } catch {
    return undefined;
  }
}

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
