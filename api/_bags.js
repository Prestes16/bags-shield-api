// api/_bags.js
const TIMEOUT_MS = Number(process.env.BAGS_TIMEOUT_MS || 7000);

function parseBases() {
  const raw = (process.env.BAGS_API_BASE || 'https://api.bags.app').trim();
  return raw.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}
function hasKey() {
  return !!process.env.BAGS_API_KEY;
}

async function getJson(url, { headers = {}, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { /* not json */ }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(t);
  }
}

/** Chama a Bags API com a primeira base que responder 2xx */
export async function getBagsTokenInfo({ mint, network = 'devnet' }) {
  if (!mint) return { ok: false, skipped: 'no_mint' };
  if (!hasKey()) return { ok: false, skipped: 'no_api_key' };

  const bases = parseBases();
  const tried = [];
  for (const base of bases) {
    const url = `${base}/v1/tokens/${encodeURIComponent(mint)}?network=${encodeURIComponent(network)}`;
    try {
      const res = await getJson(url, {
        headers: {
          'Authorization': `Bearer ${process.env.BAGS_API_KEY}`,
          'Accept': 'application/json',
          'User-Agent': 'bags-shield/0.3.6'
        }
      });
      tried.push({ base, path: '/v1/tokens/:mint', status: res.status, ok: res.ok });
      if (res.ok) return { ok: true, raw: res.json ?? {}, base, status: res.status };
      // se 401/403/404/5xx, tenta próxima base
    } catch (e) {
      tried.push({ base, path: '/v1/tokens/:mint', ok: false, error: String(e?.message || e) });
    }
  }
  // nada deu 2xx
  return {
    ok: false,
    reason: 'http_or_network_error',
    message: 'Nenhuma base respondeu 2xx',
    tried
  };
}

/** Converte respostas da Bags em "hints" pro nosso engine */
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

  const freezeNotRenounced =
    (typeof freezeAuthRenounced === 'boolean') ? !freezeAuthRenounced : undefined;
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
