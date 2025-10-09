import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, preflight, guardMethod, noStore } from './_cors.js'
import { computeRisk } from './_risk.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  noStore(res)

  if (preflight(req, res)) return
  if (!guardMethod(req, res, ['POST', 'GET', 'OPTIONS'])) return

  const body = (() => {
    try {
      if (!req.body) return {}
      if (typeof req.body === 'string') return JSON.parse(req.body)
      return req.body
    } catch {
      return {}
    }
  })()

  const q: any = (req as any).query || {}
  const numOrNull = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const input = {
    network: body.network ?? q.network ?? null,
    mint: body.mint ?? q.mint ?? null,
    amount: typeof body.amount === 'number' ? body.amount : numOrNull(q.amount),
    slippageBps: typeof body.slippageBps === 'number' ? body.slippageBps : numOrNull(q.slippageBps),
  }

  const risk = computeRisk(input)

  res.status(200).json({
    ok: true,
    endpoint: 'simulate',
    method: req.method,
    received: input,
    risk,
    at: new Date().toISOString(),
  })
}
