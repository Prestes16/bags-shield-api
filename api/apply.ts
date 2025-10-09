import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, preflight, guardMethod, noStore } from './_cors.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  noStore(res)

  if (preflight(req, res)) return
  if (!guardMethod(req, res, ['POST', 'OPTIONS'])) return

  const body = (() => {
    try {
      if (!req.body) return {}
      if (typeof req.body === 'string') return JSON.parse(req.body)
      return req.body
    } catch {
      return {}
    }
  })()

  res.status(200).json({
    ok: true,
    endpoint: 'apply',
    method: req.method,
    received: body,
    at: new Date().toISOString(),
  })
}
