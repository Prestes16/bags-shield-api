import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, preflight, guardMethod, noStore } from './_cors.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Headers padrão
  setCors(res)
  noStore(res)

  // Pré-flight CORS
  if (preflight(req, res)) return

  // Métodos permitidos (mantemos GET/POST/OPTIONS para não quebrar testes)
  if (!guardMethod(req, res, ['GET', 'POST', 'OPTIONS'])) return

  // Parse seguro do body (funciona c/ string ou objeto)
  const body = (() => {
    try {
      if (!req.body) return {}
      if (typeof req.body === 'string') return JSON.parse(req.body)
      return req.body
    } catch {
      return {}
    }
  })()

  // TODO: aqui entra sua lógica real de "scan"
  // Mantemos 200 OK para o smoke test
  res.status(200).json({
    ok: true,
    endpoint: 'scan',
    method: req.method,
    received: body,
    at: new Date().toISOString(),
  })
}



