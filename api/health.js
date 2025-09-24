// api/health.js
import { APP_VERSION } from './_version.js';
import { sendJson } from './_utils.js';

export default async function handler(req, res) {
  return sendJson(res, 200, {
    ok: true,
    service: 'bags-shield-api',
    version: APP_VERSION,
    time: new Date().toISOString(),
    network: 'devnet'
  });
}

