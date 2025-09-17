export default async function handler(_req, res) {
  res.status(200).json({ ok: true, network: "solana-devnet" });
}
