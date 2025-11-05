import type { VercelRequest, VercelResponse } from '@vercel/node';

const newRequestId = () => 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
const MODE = String(process.env.BAGS_SCAN_MODE ?? 'mock').toLowerCase();

interface ScanRequest { rawTransaction: string }
type Grade = 'A'|'B'|'C'|'D'|'E';

function simpleHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 101; // 0..100
}

function gradeFromScore(score: number): Grade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rid = newRequestId();

  res.setHeader('X-Request-Id', rid);
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success:false, error:'Method Not Allowed', meta:{ requestId: rid, mode: MODE }});
  }

  const raw = (req.body as Partial<ScanRequest> | undefined)?.rawTransaction;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ success:false, error:'rawTransaction field is missing or invalid.', meta:{ requestId: rid, mode: MODE }});
  }

  // ==== Toggle de modo por env ====
  if (MODE !== 'mock') {
    // Futuro: implementar modo 'real' aqui (quando houver upstream apropriado)
    return res.status(501).json({
      success: false,
      error: 'scan_real_mode_not_implemented_yet',
      meta: { requestId: rid, mode: MODE }
    });
  }

  // === Stub determinístico (modo: mock) ===
  const score = simpleHash(raw);
  const grade = gradeFromScore(score);
  const warnings: string[] = [];
  if (raw.length < 40) warnings.push('short_base64_input');
  if (raw.includes('==')) warnings.push('padded_base64');
  if (/[^A-Za-z0-9+/=]/.test(raw)) warnings.push('non_base64_chars');

  const isSafe = score >= 70 && warnings.length === 0;

  const response = {
    isSafe,
    shieldScore: score,
    grade,
    warnings,
    metadata: {
      mode: 'mock',
      rawLength: raw.length,
      base: process.env.BAGS_API_BASE ?? null
    }
  };

  return res.status(200).json({ success:true, response, meta:{ requestId: rid, mode: MODE }});
}