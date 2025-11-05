import type { VercelRequest, VercelResponse } from '@vercel/node';
// import { bagsFetch } from '../../../lib/bags'; // Ignoramos por enquanto

function requestId() {
  return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const BAGS_PING_URL = 'https://public-api-v2.bags.fm/api/v1/ping';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ... Configurações de CORS e Headers Padrão ...
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const rid = requestId();
  res.setHeader('X-Request-Id', rid);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // ⚠️ FETCH NATIVO (SEM CHAVE DE API) PARA TESTAR CONECTIVIDADE
    const upstream = await fetch(BAGS_PING_URL, { method: 'GET' });
    const data = await upstream.json();

    // Se a Bags retornar 200, retornamos 200. Se Bags retornar 401/403, retornamos 403 e logamos.
    if (!upstream.ok) {
        // Bags API provavelmente rejeitou a requisição (401/403)
        return res.status(upstream.status).json({ success: false, error: `Upstream error: ${upstream.status} - ${data?.error || upstream.statusText}`, meta: { requestId: rid } });
    }

    return res.status(200).json({ success: true, response: data, meta: { requestId: rid, upstreamStatus: upstream.status } });

  } catch (e: any) {
    // Captura erros de rede ou inicialização
    console.error('SERVERLESS FAILED:', e.message);
    return res.status(500).json({ success: false, error: String(e?.message ?? 'network_or_internal_error'), meta: { requestId: rid, note: 'Check BAGS_API_KEY in Vercel settings.' } });
  }
}