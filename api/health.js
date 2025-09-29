@'
module.exports = (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-BagsShield", "1");
    res.setHeader("X-App-Version", process.env.APP_VERSION || "0.3.8");

    const payload = {
      ok: true,
      service: "bags-shield-api",
      version: process.env.APP_VERSION || "0.3.8",
      time: new Date().toISOString(),
      network: process.env.SOLANA_NETWORK || "devnet",
    };

    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
};
'@ | Set-Content -Encoding UTF8 .\api\health.js
