// ESM
import { APP_VERSION } from "./_version.js";
import { SOLANA } from "./_solana.js";

function setHeaders(res) {
  res.setHeader("X-App-Version", APP_VERSION);
  res.setHeader("X-Bagsshield", "1");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "interest-cohort=()");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  let body = req.body;
  if (typeof body !== "object") {
    try { body = JSON.parse(body ?? "{}"); } catch { body = {}; }
  }

  const transactionSig = body?.transactionSig;
  const network = (body?.network || "devnet").toLowerCase();

  if (!transactionSig || typeof transactionSig !== "string" || transactionSig.length < 8) {
    res.status(400).json({
      ok: false,
      error: "invalid_transactionSig",
      message: "Envie { transactionSig: <string base58 válida> }"
    });
    return;
  }

  try {
    const resolved = await SOLANA.resolveMintFromTx(transactionSig, { network });
    res.status(200).json({ ok: true, network, transactionSig, resolved });
  } catch (e) {
    res.status(200).json({
      ok: false,
      network,
      transactionSig,
      reason: "resolve_failed",
      message: e?.message || String(e)
    });
  }
}
