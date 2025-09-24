// api/_bags.js
const TIMEOUT_MS = 7000;

function hasBagsKey() {
  return !!process.env.BAGS_API_KEY;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'bags-shield/0.3',
        ...(opts.headers || {})
      }
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Chama a Bags API se houver chave e base configuradas */
export async function getBagsTokenInfo({ mint, network = 'devnet' }) {
  if (!mint) return { ok: false, skipped: 'no_mint' };
  if (!hasBagsKey()) return { ok: false, skipped: 'no_api_key' };

  const base = process.env.BAGS_API_BASE || 'https://api.bags.app'; // ajuste conforme a doc oficial
  const path = `/v1/tokens/${encodeURIComponent(mint)}?network=${encodeURIComponent(network)}`;
  const url = `${base}${path}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${process.env.BAGS_API_KEY}` }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, reason: 'http_error', body: text?.slice(0, 500) ?? '' };
    }

    const json = await res.json().catch(() => ({}));
    return { ok: true, raw: json };
  } catch (err) {
    return { ok: false, reason: 'exception', message: String(err?.message || err) };
  }
}

/**
 * Converte vários formatos possíveis em "hints" para nosso engine:
 *  {
 *    mintAuthorityActive?: boolean,
 *    freezeNotRenounced?: boolean,
 *    top10HoldersPct?: number (0-100),
 *    tokenAgeDays?: number,
 *    liquidityLocked?: boolean,
 *    creatorReputation?: number (0-100),
 *    socialsOk?: boolean,
 *    bagsVerified?: boolean
 *  }
 */
export function hintsFromBags(raw) {
  if (!raw || typeof raw !== 'object') return {};

  // Helpers
  const pick = (obj, pathArr) => {
    for (const p of pathArr) {
      const v = p.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
      if (v != null) return v;
    }
    return undefined;
  };

  // Liquidez/lock
  const liquidityUsd = Number(
    pick(raw, [
      'liquidity.usd',
      'market.liquidityUsd',
      'metrics.liquidity.usd'
    ])
  );
  const liquidityLocked = !!pick(raw, [
    'liquidity.locked',
    'locks.hasActiveLock',
    'pool.locked'
  ]);

  // Holders top10
  const top10HoldersPct = Number(
    pick(raw, [
      'holders.top10.pct',
      'ownership.top10Pct',
      'distribution.top10Pct'
    ])
  );

  // Authorities
  const mintAuthActive = pick(raw, [
    'authorities.mint.active',
    'mintAuthority.active',
    'token.mintAuthorityActive'
  ]);
  // Renunciado? se renunciado = true → ativo = false
  const mintAuthRenounced = pick(raw, [
    'authorities.mint.renounced',
    'mintAuthority.renounced'
  ]);
  const mintAuthorityActive =
    typeof mintAuthActive === 'boolean'
      ? mintAuthActive
      : typeof mintAuthRenounced === 'boolean'
        ? !mintAuthRenounced
        : undefined;

  const freezeAuthRenounced = pick(raw, [
    'authorities.freeze.renounced',
    'freezeAuthority.renounced'
  ]);
  const freezeNotRenounced =
    typeof freezeAuthRenounced === 'boolean' ? !freezeAuthRenounced : undefined;

  // Idade do token
  const createdAt = pick(raw, [
    'createdAt',
    'mintedAt',
    'token.createdAt',
    'metadata.createdAt'
  ]);
  let tokenAgeDays;
  if (createdAt) {
    const t = new Date(createdAt).getTime();
    if (!Number.isNaN(t)) {
      const diffMs = Date.now() - t;
      tokenAgeDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Socials
  const socials = pick(raw, [
    'socials',
    'metadata.socials',
    'links.social'
  ]);
  const socialsOk = Array.isArray(socials)
    ? socials.length > 0
    : socials && typeof socials === 'object'
      ? Object.values(socials).some(Boolean)
      : false;

  // Verificado /

