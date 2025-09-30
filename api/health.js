module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    ok: true,
    service: "bags-shield-api",
    version: "0.3.9",
    time: new Date().toISOString(),
    network: process.env.SOLANA_NETWORK || "devnet"
  });
};
