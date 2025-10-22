const fs = require("fs");
const f = "api/apply/index.ts";
let s = fs.readFileSync(f, "utf8");

// novo bloco v3 — tenta req.body/rawBody antes de stream
const block = `/* --- BEGIN readJsonRobust (v3) --- */
type _IMsg = import('node:http').IncomingMessage;

function _bufFrom(x: any): Buffer | null {
  try {
    if (!x && x !== 0) return null;
    if (Buffer.isBuffer(x)) return x;
    if (typeof x === "string") return Buffer.from(x, "utf8");
    return Buffer.from(String(x), "utf8");
  } catch { return null; }
}

function _tryParseByCT<T>(txt: string, ct: string): T | null {
  let s = txt;
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  s = s.trim();
  const lo = (ct || "").toLowerCase();
  if (lo.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(s);
    const obj: Record<string,string> = {}; for (const [k,v] of params.entries()) obj[k]=v;
    return obj as any as T;
  }
  // JSON declarado ou que aparenta JSON
  if (lo.includes("application/json") || /^[\\[{]/.test(s)) {
    try { return JSON.parse(s) as T; } catch {}
  }
  // tentativa final
  try { return JSON.parse(s) as T; } catch {}
  return null;
}

function _collectBodyEvents(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (c: any) => {
      try { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); } catch (e) { cleanup(); reject(e); }
    };
    const onEnd  = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const onErr  = (e: any) => { cleanup(); reject(e || new Error("stream error")); };
    const cleanup = () => {
      req.off?.('data', onData); req.off?.('end', onEnd);
      req.off?.('error', onErr); req.off?.('aborted', onErr);
      req.removeListener?.('data', onData);
      req.removeListener?.('end', onEnd);
      req.removeListener?.('error', onErr);
      req.removeListener?.('aborted', onErr);
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onErr);
    req.on('aborted', onErr);

    // best-effort: se algo já está no buffer, puxa uma primeira leitura
    if (typeof req.read === 'function' && req.readable) {
      const first = req.read();
      if (first) chunks.push(Buffer.isBuffer(first) ? first : Buffer.from(first));
    }
  });
}

export async function readJsonRobust<T = any>(req: _IMsg & { body?: any; rawBody?: any }): Promise<T|null> {
  try {
    const ct = String((req.headers && (req.headers['content-type'] || (req as any).headers?.['Content-Type'])) || '');
    // 0) req.body (frameworks que preparseiam)
    if ((req as any).body !== undefined) {
      const b = (req as any).body;
      if (b === null) return null;
      if (typeof b === "object") return b as T;
      if (typeof b === "string") {
        const parsed = _tryParseByCT<T>(b, ct);
        if (parsed !== null) return parsed;
      }
    }
    // 1) rawBody comum em alguns runtimes
    if ((req as any).rawBody !== undefined) {
      const buf = _bufFrom((req as any).rawBody);
      if (buf && buf.length) {
        const parsed = _tryParseByCT<T>(buf.toString("utf8"), ct);
        if (parsed !== null) return parsed;
      }
    }
    // 2) stream padrão (data/end)
    const buf = await _collectBodyEvents(req as any);
    if (!buf || buf.length === 0) return null;
    return _tryParseByCT<T>(buf.toString("utf8"), ct);
  } catch (e) {
    console.error("[readJsonRobust v3] error:", e);
    return null;
  }
}
/* --- END readJsonRobust (v3) --- */
`;

const beginA = "/* --- BEGIN readJsonRobust";
const endA   = "/* --- END readJsonRobust";
function replaceBetween(src, begin, end, repl) {
  const i = src.indexOf(begin);
  const j = src.indexOf(end);
  if (i >= 0 && j > i) {
    const k = j + end.length;
    return src.slice(0, i) + repl + src.slice(k);
  }
  return null;
}

let out = replaceBetween(s, beginA, endA, block);
if (out === null) {
  // fallback: injeta logo após primeiro bloco de imports
  const pos = s.indexOf('\n\n') >= 0 ? s.indexOf('\n\n') + 2 : 0;
  out = s.slice(0, pos) + block + s.slice(pos);
}
fs.writeFileSync(f, out);
console.log("patched", f);
