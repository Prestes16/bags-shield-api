import type { VercelRequest, VercelResponse } from '@vercel/node'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS'

export function setCors(
  res: VercelResponse,
  origin: string = '*',
  methods: Method[] = ['GET', 'POST', 'OPTIONS'],
  headers: string[] = ['Content-Type', 'Authorization', 'X-Requested-With']
): void {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '))
  res.setHeader('Access-Control-Allow-Headers', headers.join(', '))
  res.setHeader('Access-Control-Max-Age', '86400') // 24h
}

export function noStore(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

export function preflight(req: VercelRequest, res: VercelResponse): boolean {
  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    setCors(res)
    noStore(res)
    res.status(204).end()
    return true
  }
  return false
}

export function guardMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowed: Method[]
): boolean {
  const method = ((req.method || 'GET').toUpperCase() as Method)
  if (!allowed.includes(method)) {
    setCors(res)
    noStore(res)
    res.setHeader('Allow', allowed.join(', '))
    res.status(405).json({ ok: false, error: 'Method Not Allowed', allow: allowed })
    return false
  }
  return true
}
