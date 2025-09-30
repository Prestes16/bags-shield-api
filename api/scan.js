module.exports = async (req, res) => {
  try {
    const mint = (req.body && req.body.mint) || null;
    res.status(200).json({
      ok: true,
      id: "bsr_stub",
      decision: "safe",
      reason: "stub",
      score: 5,
      risk: { level: "safe", badge: { text: "SAFE", color: "#00FFA3" }, factors: [] },
      network: process.env.SOLANA_NETWORK || "devnet",
      tokenMint: mint,
      transactionSig: null,
      requestedBy: "api",
      ts: new Date().toISOString(),
      bags: { ok: false }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
