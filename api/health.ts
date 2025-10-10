import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, preflight, guardMethod, noStore } from './_cors.js'
import { reqId, computeEtag, logReq } from './_util.js'

const VERSION = '1.1.0'
const SERVICE = 'bags-shield-api'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = reqId()
  setCors(res, "*", ["GET","POST","OPTIONS"], ["Content-Type","Authorization","X-Requested-With"], req)
  noStore(res)
  res.setHeader('X-Request-Id', id)

  if (preflight(req, res)) {
    logReq(id, req, { endpoint: 'health', preflight: true })
    return
  }

  if (!guardMethod(req, res, ['GET', 'OPTIONS'])) {
    logReq(id, req, { endpoint: 'health', blocked: true })
    return
  }

  const payload = {
    ok: true,
    service: SERVICE,
    version: VERSION,
    status: 'healthy',
    env: {
      runtime: 'node',
      node: process.version,
      vercel: !!process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      bagsEnv: process.env.BAGS_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
    git: {
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    },
    uptimeSec: Math.round(process.uptime()),
    requestId: id,
    time: new Date().toISOString(),
  }

  const etag = computeEtag(payload)
  if (etag) res.setHeader('ETag', etag)

  logReq(id, req, { endpoint: 'health', status: 200 })

  res.status(200).json(payload)
}
