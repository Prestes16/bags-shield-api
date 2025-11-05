import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bagsFetch } from '../../../lib/bags'; // Caminho Corrigido (3 níveis)

function requestId() {
  return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ScanRequest {
  rawTransaction: string;
}
interface ScanResponse {
  isSafe: boolean;
  warnings: string[];
  metadata: Record<string, any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rid = requestId();
  res.setHeader('X-Request-Id', rid);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  res.setHeader('Access-Control-Allow-Origin', '*'); // CORS

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { rawTransaction } = req.body as ScanRequest;

  // 🚨 Validação Crítica da Entrada
  if (!rawTransaction || typeof rawTransaction !== 'string') {
    return res.status(400).json({ success: false, error: 'rawTransaction field is missing or invalid.', meta: { requestId: rid } });
  }

  try {
    // 💡 Chamada real à Bags API para a rota 'scan' (Endpoint 'scan' revalidado)
    const { data, res: upstream } = await bagsFetch<ScanResponse>('scan', {
      method: 'POST',
      body: JSON.stringify({ rawTransaction }),
      headers: { 'Content-Type': 'application/json' },
    });

    return res.status(200).json({ success: true, response: data, meta: { requestId: rid, rate: {
      limit: upstream.headers.get('X-RateLimit-Limit'),
      remaining: upstream.headers.get('X-RateLimit-Remaining'),
      reset: upstream.headers.get('X-RateLimit-Reset'),
    } } });
    
  } catch (e: any) {
    // Tratamento de erro padronizado do Bags Shield
    const status = Number(e?.status) || 500;
    
    // Log do erro completo no console do Vercel
    console.error(`SCAN FAILED: Status=${status}. Error details:`, e.message);

    return res.status(status).json({
      success: false, 
      error: String(e?.message ?? 'upstream_scan_error_unknown'), 
      meta: { requestId: rid, note: 'Check Vercel Execution Logs for full error object.' } 
    });
  }
}