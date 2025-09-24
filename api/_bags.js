// api/_bags.js
const TIMEOUT_MS = 4000;

function hasBagsKey() {
  return !!process.env.BAGS_API_KEY;
}

// fetch com timeout (AbortController)
async function fetchWithTimeout(url, opts = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * getBagsTokenInfo: tenta enriquecer dados do token via Bags.
 * Não conhecemos o endpoint exato → deixamos base configurável.
 * Se falhar, retorna { ok:false, reason } sem quebrar sua API.
 */
export async function getBagsTokenInfo({ mint, network = 'devnet' }) {
  if (!mint) return { ok: false, skipped: 'no_mint' };
  if (!hasBagsKey()) return { ok: false, skipped: 'no_api_key' };

  try {
    const base = process.env.BAGS_API_BASE || 'https://api.bags.app'; // ajuste se necessário
    // Exemplo de caminho; ajuste depois que tiver a doc oficial:
    const url = `${base}/v1/tokens/${encodeURIComponent(mint)}?network=${encodeURIComponent(network)}`;

    const res = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${process.env.BAGS_API_KEY}`,
        'Accept': 'application/json'
      }
    }, TIMEOUT_MS);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, reason: 'http_error', body: text?.slice(0, 500) ?? '' };
    }

    const json = await res.json().catch(() => ({}));

    // Não mapeamos campos (API desconhecida). Exponha "raw" para auditoria.
    return { ok: true, raw: json };
  } catch (err) {
    return { ok: false, reason: 'exception', message: String(err?.message || err) };
  }
}
