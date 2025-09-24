// api/health.js
export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'bags-shield-api',
    version: '0.3.3', // bump para conferir deploy
    time: new Date().toISOString(),
    network: 'devnet'
  });
}

