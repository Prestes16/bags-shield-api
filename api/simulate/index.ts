import type { IncomingMessage, ServerResponse } from 'node:http';

type Network = 'devnet' | 'mainnet';

type SimulatePayload = {
  mint?: string;
  network?: Network;
  scenario?: string; // e.g., "apply_flag", "unflag", "limit_trading", "freeze"
  params?: Record<string, unknown>;
};

type Json = Record<string, unknown>;

function setCommonHeaders(res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res: ServerResponse, status: number, body: Json) {
  setCommonHeaders(res);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function allow(res: ServerResponse, methods: string) {
  res.setHeader('Allow', methods);
}

async function readJson<T = unknown>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function badRequest(res: ServerResponse, message: string) {
  return sendJson(res, 400, {
    ok: false,
    error: { code: 'BAD_REQUEST', message },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}

function unauthorized(res: ServerResponse, message = 'Missing or invalid Authorization header') {
  return sendJson(res, 401, {
    ok: false,
    error: { code: 'UNAUTHORIZED', message },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}

function simulateScenario(scenario: string, params: Record<string, unknown> = {}) {
  // Regras de exemplo coerentes com DOCUMENTOS BAGS (placeholder de simulação local)
  // Retorna um "expectedOutcome" e um "scoreDelta" para orientar a decisão.
  const s = scenario.toLowerCase();

  if (s === 'apply_flag') {
    const severity = String(params.severity ?? 'medium').toLowerCase(); // low | medium | high
    if (severity === 'low')   return { expectedOutcome: 'warning',             scoreDelta: -5 };
    if (severity === 'high')  return { expectedOutcome: 'trading_restricted',  scoreDelta: -22 };
    return                        { expectedOutcome: 'restricted',            scoreDelta: -12 }; // medium (default)
  }

  if (s === 'unflag') {
    return { expectedOutcome: 'normal', scoreDelta: +15 };
  }

  if (s === 'limit_trading') {
    const limit = Number(params.limit ?? 0.5); // 0..1
    const delta = Math.max(-20, Math.min(-5, Math.round(-10 * limit * 2))); // aprox.
    return { expectedOutcome: 'limited', scoreDelta: delta };
  }

  if (s === 'freeze') {
    return { expectedOutcome: 'frozen', scoreDelta: -30 };
  }

  // Cenário desconhecido → neutro, mas informado
  return { expectedOutcome: 'unknown_scenario', scoreDelta: 0 };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'POST').toUpperCase();

  if (method === 'OPTIONS') {
    setCommonHeaders(res);
    res.statusCode = 204;
    return res.end();
  }

  if (method !== 'POST') {
    allow(res, 'POST, OPTIONS');
    return sendJson(res, 405, {
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' },
      meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
    });
  }

  // Auth mínima
  const auth = (req.headers['authorization'] || '').toString();
  if (!auth.startsWith('Bearer ') || auth.trim().length <= 'Bearer '.length) {
    return unauthorized(res);
  }

  const body = await readJson<SimulatePayload>(req);
  if (!body) return badRequest(res, 'JSON body obrigatório');

  const mint = (body.mint || '').trim();
  const scenario = (body.scenario || '').trim();
  const network = (body.network || process.env.BAGS_ENV || 'devnet') as Network;
  const params = (body.params && typeof body.params === 'object') ? body.params : {};

  if (!mint) return badRequest(res, "Campo 'mint' é obrigatório");
  if (!scenario) return badRequest(res, "Campo 'scenario' é obrigatório");
  if (!['devnet', 'mainnet'].includes(network)) return badRequest(res, "Campo 'network' deve ser 'devnet' ou 'mainnet'");

  const result = simulateScenario(scenario, params);

  return sendJson(res, 200, {
    ok: true,
    data: {
      mint,
      network,
      scenario,
      params,
      ...result,
    },
    meta: { service: 'bags-shield-api', version: '1.0.0', time: new Date().toISOString() },
  });
}
