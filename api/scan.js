@'
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  try {
    const body = await readBody(req);
    const mint = body?.mint || null;

    // resposta mínima “safe”
    const resp = {
      ok: true,
      id: "bsr_" + Math.random().toString(36).slice(2, 10),
      decision: "safe",
      reason: "Sem sinais relevantes de risco",
      score: 5,
      risk: {
        level: "safe",
        badge: { text: "SAFE", color: "#00FFA3" },
        factors: [{ key: "liquidity_unknown", score: 5, detail: "Status de liquidez desconhecido" }]
      },
      network: process.env.SOLANA_NETWORK || "devnet",
      tokenMint: mint,
      transactionSig: null,
      requestedBy: "client:unknown",
      ts: new Date().toISOString(),
      bags: { ok: true, base: "stub", status: 200, tried: [], raw: { success: true, response: [] }, hints: { bagsVerified: false } },
      tx: null
    };

    res.statusCode = 200;
    res.end(JSON.stringify(resp));
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "bad_request" }));
  }
};
'@ | Set-Content -Encoding UTF8 .\api\scan.js
