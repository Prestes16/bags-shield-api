import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, preflight, guardMethod } from './_cors.js'
import { reqId, applyEtag, cacheNoCache, logReq } from './_util.js'

const VERSION = '1.1.0'
const SERVICE = 'bags-shield-api'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = reqId()
  setCors(res, "*", ["GET","POST","OPTIONS"], ["Content-Type","Authorization","X-Requested-With"], req)
  cacheNoCache(res) // revalidação sempre (permite 304 com ETag)
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
      region: process.env.VERCEL_REGION ?? 'dev1',
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

  // ETag baseada APENAS na parte estável
  const etagBase = { service: SERVICE, version: VERSION, env: payload.env, git: payload.git }
  if (applyEtag(req as any, res as any, etagBase)) {
    logReq(id, req, { endpoint: 'health', status: 304 })
    return
  }

  logReq(id, req, { endpoint: 'health', status: 200 })
  res.status(200).json(payload)
}

