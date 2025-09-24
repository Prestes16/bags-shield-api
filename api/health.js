// api/health.js
export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'bags-shield-api',
    version: '0.3.5', // bump para confirmar que este deploy entrou
    time: new Date().toISOString(),
    network: 'devnet'
  });
}
