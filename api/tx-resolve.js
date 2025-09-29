module.exports = async (req, res) => {
  const transactionSig = (req.body && req.body.transactionSig) || null;
  const network = (req.body && req.body.network) || process.env.SOLANA_NETWORK || "devnet";
  res.status(200).json({
    ok: true,
    network,
    transactionSig,
    resolved: { ok: false, reason: "not_implemented", tried: [] }
  });
};
