// api/_bags.js
// Conector Bags — runtime-safe (fetch + timeout), configurável por ENV e com rate-limit headers.
// Agora SEMPRE inclui `tried` (mesmo em sucesso), para facilitar diagnóstico no cliente.

// ENV (Production na Vercel):
// - BAGS_API_KEY              (obrigatório)
// - BAGS_API_BASE             (ex.: https://public-api-v2.bags.fm) — aceita múltiplas, separadas por vírgula
// - BAGS_API_TOKENS_PATH      (ex.: '/api/v1/token-launch/lifetime-fees' OU '/api/v1/tokens/:mint')
// - BAGS_API_MINT_PARAM       (ex.: 'tokenMint' — quando o endpoint espera o mint na query)
// - BAGS_API_NETWORK_PARAM    (ex.: 'network' — só use se o endpoint suportar isso)
// - BAGS_API_EXTRA_QUERY      (ex.: 'foo=1&bar=2')
// - BAGS_AUTH_MODE            ('header' | 'bearer' — default 'header')
// - BAGS_AUTH_HEADER          (default 'x-api-key' quando mode=header)
// - BAGS_TIMEOUT_MS           (default 7000)

const TIMEOUT_MS = Number(process.env.BAGS_TIMEOUT_MS || 7000);

function parseBases() {
  const raw = (process.env.BAGS_API_BASE || 'https://public-api-v2.bags.fm').trim();
  return raw.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}
function hasKey() { return !!process.env.BAGS_API_KEY; }

function buildAuthHeaders() {
  const mode = (process.env.BAGS_AUTH_MODE || 'header').toLowerCase(); // default: header x-api-key
  const key = process.env.BAGS_API_KEY || '';
  if (!key) return {};
  if (mode === 'header') {
    const h = process.env.BAGS_AUTH_HEADER || 'x-api-key';
    return { [h]: key };
  }
  return { 'Authorization': `Bearer ${key}` };
}

function applyPathTemplate(tpl, { mint }) {
  // Suporta ':mint' no path (ex.: '/api/v1/tokens/:mint')
  return tpl.replace(/:mint/gi, encodeURIComponent(mint));
}

function buildQuery({ network, mint }) {
  const qs = new URLSearchParams();

  const netParam = process.env.BAGS_API_NETWORK_PARAM || '';
  if (netParam && network) qs.set(netParam, network);

  const mintParam = process.env.BAGS_API_MINT_PARAM || '';
  if (mintParam && mint) qs.set(mintParam, mint);

  const extra = process.env.BAGS_API_EXTRA_QUERY || '';
  if (extra) {
    for (const kv of extra.split('&')) {
      if (!kv) continue;
      const [k, v] = kv.split('=');
      if (k) qs.set(k, v ?? '');
    }
  }

  const s = qs.toString();
  return s ? `?${s}` : '';
}

function pickRateLimit(headers) {
  // Headers HTTP são case-insensitive
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const out = {};
  if (remaining != null) out.remaining = Number(remaining);
  if (reset != null) out.reset = reset;
  return Object.keys(out).length ? out : undefined;
}

async function getJson(url, { headers = {}, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch {}
    const rateLimit = pickRateLimit(res.headers);
    return { ok: res.ok, status: res.status, text, json, rateLimit };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca infos na Bags usando a primeira BASE que responder 2xx.
 * Retorna:
 *  - sucesso: { ok:true, raw, base, status, rateLimit, tried:[{...}] }
 *  - falha:   { ok:false, reason, message, tried:[{...}] }
 */
export async function getBagsTokenInfo({ mint, network = 'devnet' }) {
  if (!mint) return { ok: false, skipped: 'no_mint', tried: [] };
  if (!hasKey()) return { ok: false, skipped: 'no_api_key', tried: [] };

  const bases = parseBases();
  const pathTpl = process.env.BAGS_API_TOKENS_PATH || '/api/v1/token-launch/lifetime-fees';
  const auth = buildAuthHeaders();

  const tried = [];
  for (const base of bases) {
    const path = pathTpl.includes(':mint') ? applyPathTemplate(pathTpl, { mint }) : pathTpl;
    const url = `${base}${path}${buildQuery({ network, mint })}`;

    try {
      const res = await getJson(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'bags-shield/0.3.8', ...auth }
      });

      // registra tentativa SEMPRE (inclusive sucesso)
      tried.push({ base, path, url, status: res.status, ok: res.ok, rateLimit: res.rateLimit });

      if (res.ok) {
        // sucesso: devolve tried preenchido
        return { ok: true, raw: res.json ?? {}, base, status: res.status, rateLimit: res.rateLimit, tried };
      }
      // 4xx/5xx → tenta próxima base
    } catch (e) {
      tried.push({ base, path, url, ok: false, error: String(e?.message || e) });
    }
  }

  return {
    ok: false,
    reason: 'http_or_network_error',
    message: 'Nenhuma base respondeu 2xx',
    tried
  };
}

/**
 * Converte JSON da Bags em "hints" que o motor de risco entende.
 * Se o endpoint não possuir esses campos, retorna {} (motor cai em SAFE/WARN por falta de sinais).
 */
export function hintsFromBags(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const pick = (obj, paths) => {
    for (const p of paths) {
      const v = p.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
      if (v != null) return v;
    }
    return undefined;
  };

  const liquidityUsd = Number(pick(raw, ['liquidity.usd','market.liquidityUsd','metrics.liquidity.usd']));
  const liquidityLockedRaw = pick(raw, ['liquidity.locked','locks.hasActiveLock','pool.locked']);
  const top10HoldersPct = Number(pick(raw, ['holders.top10.pct','ownership.top10Pct','distribution.top10Pct']));

  const mintAuthActive = pick(raw, ['authorities.mint.active','mintAuthority.active','token.mintAuthorityActive']);
  const mintAuthRenounced = pick(raw, ['authorities.mint.renounced','mintAuthority.renounced']);
  const freezeAuthRenounced = pick(raw, ['authorities.freeze.renounced','freezeAuthority.renounced']);

  const createdAt = pick(raw, ['createdAt','mintedAt','token.createdAt','metadata.createdAt']);
  const socials = pick(raw, ['socials','metadata.socials','links.social']);
  const bagsVerified = !!pick(raw, ['verified','badges.verified','flags.verified']);
  let creatorReputation = pick(raw, ['creator.reputation','owner.reputation','project.reputation']);

  const hints = {};

  if (!Number.isNaN(liquidityUsd)) {
    const explicitLock = (typeof liquidityLockedRaw === 'boolean') ? liquidityLockedRaw : undefined;
    hints.liquidityLocked = (explicitLock !== undefined) ? explicitLock : liquidityUsd > 1000;
  }

  if (typeof top10HoldersPct === 'number' && !Number.isNaN(top10HoldersPct)) {
    hints.top10HoldersPct = top10HoldersPct;
  }

  const mintAuthorityActiveFinal =
    (typeof mintAuthActive === 'boolean') ? mintAuthActive
    : (typeof mintAuthRenounced === 'boolean') ? !mintAuthRenounced
    : undefined;
  if (typeof mintAuthorityActiveFinal === 'boolean') hints.mintAuthorityActive = mintAuthorityActiveFinal;

  const freezeNotRenounced = (typeof freezeAuthRenounced === 'boolean') ? !freezeNotRenounced : undefined;
  if (typeof freezeNotRenounced === 'boolean') hints.freezeNotRenounced = freezeNotRenounced;

  if (createdAt) {
    const t = Date.parse(createdAt);
    if (!Number.isNaN(t)) hints.tokenAgeDays = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  if (Array.isArray(socials)) hints.socialsOk = socials.length > 0;
  else if (socials && typeof socials === 'object') hints.socialsOk = Object.values(socials).some(Boolean);

  if (typeof creatorReputation === 'number') {
    hints.creatorReputation = Math.max(0, Math.min(100, creatorReputation));
  } else if (bagsVerified) {
    hints.creatorReputation = 65;
  }

  hints.bagsVerified = bagsVerified;
  return hints;
}
// ...código anterior omitido (o seu já está ok desde a última atualização)
if (res.ok) {
  return { ok: true, raw: res.json ?? {}, base, status: res.status, rateLimit: res.rateLimit, tried };
}

