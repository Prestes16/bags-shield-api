export default async function handler(req: any, res: any) {
  const requestId =
    (globalThis as any)?.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);

  // CORS básico (liberado) + no-store + expose do X-Request-Id
  const allowOrigin = req.headers?.origin || '*';
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Expose-Headers': 'X-Request-Id',
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
  };

  for (const [k, v] of Object.entries(baseHeaders)) res.setHeader(k, v);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // HEAD sem body
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  // Apenas GET permitido
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method Not Allowed', meta: { requestId } });
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(
    JSON.stringify({
      success: true,
      response: { status: 'ok' },
      meta: { requestId },
    })
  );
}