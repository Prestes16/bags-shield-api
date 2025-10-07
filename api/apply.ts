export default async function handler(req: any, res: any) {
  // CORS + cache
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Bags-API-Key");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const mint = body.mint;
    const network = (body.network || "devnet").toLowerCase();
    const amountRaw = body.amount;
    let slippageBps = Number.isInteger(body.slippageBps) ? body.slippageBps : 50;

    // validações
    if (!mint || typeof mint !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid 'mint' (string required)" });
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(mint)) {
      return res.status(400).json({ ok: false, error: "Invalid 'mint' format (base58-like required)" });
    }
    if (!["devnet", "mainnet", "mainnet-beta", "testnet"].includes(network)) {
      return res.status(400).json({ ok: false, error: "Invalid 'network' (devnet|mainnet|mainnet-beta|testnet)" });
    }

    const amount = amountRaw === undefined ? null : Number(amountRaw);
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      return res.status(400).json({ ok: false, error: "Invalid 'amount' (> 0 number required)" });
    }
    if (slippageBps < 0 || slippageBps > 2000) {
      return res.status(400).json({ ok: false, error: "Invalid 'slippageBps' (0..2000)" });
    }

    // mock de construção de transação (dev only)
    const payload = {
      mock: true,
      kind: "swap-mock",
      network,
      mint,
      amount,
      slippageBps,
      nonce: Date.now()
    };

    // base64 "transação" (apenas para testes de fluxo com Phantom devnet)
    const base64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return res.status(200).json({
      ok: true,
      action: "apply",
      network,
      mint,
      amount,
      slippageBps,
      tx: { type: "mock-base64", base64, expiresAt },
      time: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: "Internal Error", detail: err?.message ?? String(err) });
  }
}
