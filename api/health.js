export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'bags-shield-api',
    version: '0.2.1', // bump p/ forçar redeploy
    time: new Date().toISOString(),
    network: process.env.SOLANA_NETWORK || 'devnet'
  });
}

