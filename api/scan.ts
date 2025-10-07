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

    if (!mint || typeof mint !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid 'mint' (string required)" });
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(mint)) {
      return res.status(400).json({ ok: false, error: "Invalid 'mint' format (base58-like required)" });
    }
    if (!["devnet", "mainnet", "mainnet-beta", "testnet"].includes(network)) {
      return res.status(400).json({ ok: false, error: "Invalid 'network' (devnet|mainnet|mainnet-beta|testnet)" });
    }

    // Mock de scoring para dev: determinístico e simples
    const isWrappedSol = mint.startsWith("So1111"); // Wrapped SOL (conhecido)
    const score = isWrappedSol ? 95 : 70 + (mint.charCodeAt(0) % 25);
    const level = score >= 85 ? "low" : score >= 65 ? "medium" : "high";
    const issues: string[] = [];
    if (isWrappedSol) issues.push("Well-known mint: Wrapped SOL (not a typical token scan target).");

    return res.status(200).json({
      ok: true,
      action: "scan",
      network,
      mint,
      result: { score, level, issues },
      time: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: "Internal Error", detail: err?.message ?? String(err) });
  }
}
