// api/health.js
import { APP_VERSION } from './_version.js';

export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'bags-shield-api',
    version: APP_VERSION,
    time: new Date().toISOString(),
    network: 'devnet'
  });
}
