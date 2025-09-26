// api/health.js
import { APP_VERSION } from './_version.js';

export default function handler(req, res) {
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader('X-Bagsshield', '1');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    res.status(200).send(JSON.stringify({
      ok: true,
      service: 'bags-shield-api',
      version: APP_VERSION,
      time: new Date().toISOString(),
      network: process.env.SOLANA_NETWORK || 'devnet'
    }));
  } catch (e) {
    res.status(200).send(JSON.stringify({
      ok: false,
      error: { code: 500, message: String(e?.message || e) }
    }));
  }
}
