import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, preflight, guardMethod, noStore } from './_cors.js'
import { computeRisk } from './_risk.js'
import { reqId, computeEtag, logReq } from './_util.js'
import { rateLimit } from './_rate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ID + headers base
  const id = reqId()
  setCors(res, "*", ["GET","POST","OPTIONS"], ["Content-Type","Authorization","X-Requested-With"], req)
  noStore(res)
  res.setHeader('X-Request-Id', id)

  // Pré-flight
  if (preflight(req, res)) {
    logReq(id, req, { endpoint: 'scan', preflight: true })
    return
  }

  // Métodos permitidos
  if (!guardMethod(req, res, ['GET', 'POST', 'OPTIONS'])) {
    logReq(id, req, { endpoint: 'scan', blocked: true })
    return
  }

  // Rate limit (env: RATE_MAX, RATE_WINDOW_MS)
  const rl = await rateLimit(req as any, res as any)
  if (!rl.ok) {
    logReq(id, req, { endpoint: 'scan', rateLimited: true, ip: rl.ip })
    return
  }

  // Body seguro
  const body = (() => {
    try {
      if (!req.body) return {}
      if (typeof req.body === 'string') return JSON.parse(req.body)
      return req.body
    } catch {
      return {}
    }
  })()

  // Unificar entrada: body > query
  const q: any = (req as any).query || {}
  const input = {
    network: body.network ?? q.network ?? null,
    mint: body.mint ?? q.mint ?? null,
  }

  // Cálculo de risco
  const risk = computeRisk(input)

  // Resposta
  const resp = {
    ok: true,
    endpoint: 'scan',
    method: req.method,
    received: input,
    risk,
    requestId: id,
    at: new Date().toISOString(),
  }

  // ETag fraca (debug)
  const etag = computeEtag(resp)
  if (etag) res.setHeader('ETag', etag)

  // Log mínimo
  logReq(id, req, { endpoint: 'scan', status: 200, rate: { limit: rl.limit, remaining: rl.remaining, reset: rl.reset } })

  res.status(200).json(resp)
}

