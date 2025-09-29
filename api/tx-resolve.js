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
    const sig  = body?.transactionSig || null;
    const net  = body?.network || process.env.SOLANA_NETWORK || "devnet";

    const resolved = {
      ok: false,
      reason: "not_implemented",
      tried: []
    };

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, network: net, transactionSig: sig, resolved }));
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "bad_request" }));
  }
};
'@ | Set-Content -Encoding UTF8 .\api\tx-resolve.js
