// api/_solana.js
// ESM — Node 18+ (fetch nativo). Resolve mint a partir de uma transactionSig usando JSON-RPC da Solana.

const DEF = {
  timeouts: { rpc: 8000 },
};

function getRpcUrl(network = 'devnet') {
  const env = process.env.SOLANA_RPC_URL?.trim();
  if (env) return env;
  if (network === 'mainnet' || network === 'mainnet-beta') return 'https://api.mainnet-beta.solana.com';
  return 'https://api.devnet.solana.com';
}

async function rpc(url, method, params = [], { timeoutMs = DEF.timeouts.rpc, headers = {} } = {}) {
  const ctrl = new AbortController();
  const id = Math.floor(Math.random() * 1e6);
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: ctrl.signal,
    });

    const status = res.status;
    const text = await res.text();

    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!res.ok) return { ok: false, status, error: 'http_error', json };
    if (json?.error) return { ok: false, status, error: 'rpc_error', json };

    return { ok: true, status, json };
  } finally {
    clearTimeout(t);
  }
}

async function getTransaction(signature, { network = 'devnet', timeoutMs = DEF.timeouts.rpc } = {}) {
  const url = getRpcUrl(network);
  return rpc(url, 'getTransaction', [
    signature,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
  ], { timeoutMs });
}

function extractMintFromTxResult(result) {
  const meta = result?.json?.result?.meta;
  if (!meta) return null;

  // Preferir balances (mais confiável)
  const groups = [
    meta.postTokenBalances || [],
    meta.preTokenBalances || [],
  ];
  for (const arr of groups) {
    for (const b of arr) {
      if (b?.mint) return b.mint;
    }
  }

  // Fallback: instruções parsed
  const msg = result?.json?.result?.transaction?.message;
  const ixs = msg?.instructions || [];
  for (const ix of ixs) {
    const mi = ix?.parsed?.info?.mint || ix?.parsed?.info?.tokenMint;
    if (mi) return mi;
  }
  return null;
}

async function resolveMintFromTx(signature, { network = 'devnet', timeoutMs = DEF.timeouts.rpc } = {}) {
  const url = getRpcUrl(network);
  const res = await getTransaction(signature, { network, timeoutMs });

  const tried = [{
    base: url,
    method: 'getTransaction',
    status: res?.status,
    ok: !!res?.ok,
  }];

  if (!res?.ok) {
    return { ok: false, reason: res?.error || 'rpc_failed', tried };
  }
  const mint = extractMintFromTxResult(res);
  if (mint) return { ok: true, mint, tried };

  return { ok: false, reason: 'mint_not_found', tried };
}

export const SOLANA = {
  getRpcUrl,
  rpc,
  getTransaction,
  extractMintFromTxResult,
  resolveMintFromTx,
};

export default SOLANA;
