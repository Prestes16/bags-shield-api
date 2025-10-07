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

    if (!mint || typeof mint !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid 'mint' (string required)" });
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(mint)) {
      return res.status(400).json({ ok: false, error: "Invalid 'mint' format (base58-like required)" });
    }
    if (!["devnet", "mainnet", "mainnet-beta", "testnet"].includes(network)) {
      return res.status(400).json({ ok: false, error: "Invalid 'network' (devnet|mainnet|mainnet-beta|testnet)" });
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid 'amount' (> 0 number required)" });
    }

    // slippage padrão 50 bps (0.5%)
    let slippageBps = Number.isInteger(body.slippageBps) ? body.slippageBps : 50;
    if (slippageBps < 0 || slippageBps > 2000) {
      return res.status(400).json({ ok: false, error: "Invalid 'slippageBps' (0..2000)" });
    }

    // preço/impacto determinístico e simples (mock)
    const isWrappedSol = mint.startsWith("So1111");
    const priceImpactBps = isWrappedSol ? 20 : (mint.charCodeAt(0) % 120) + 30; // 0.20%..1.50%
    const protocolFeeBps = 25; // 0.25%
    const estimatedFeeSOL = 0.0005; // mock de taxa fixa

    const gross = amount;
    const afterSlippage = gross * (1 - slippageBps / 10000);
    const expectedOut = afterSlippage * (1 - priceImpactBps / 10000);

    const round = (n: number) => Number(n.toFixed(8));

    return res.status(200).json({
      ok: true,
      action: "simulate",
      network,
      mint,
      amount: round(amount),
      slippageBps,
      quote: {
        route: isWrappedSol ? "direct" : "mock-router",
        expectedOutAmount: round(expectedOut),
        priceImpactBps,
        fee: { protocolBps: protocolFeeBps, estimatedSOL: estimatedFeeSOL }
      },
      time: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: "Internal Error", detail: err?.message ?? String(err) });
  }
}
