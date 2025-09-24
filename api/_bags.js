// api/_bags.js
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { URL } from 'url';

const TIMEOUT_MS = 7000;

function hasBagsKey() {
  return !!process.env.BAGS_API_KEY;
}

function httpGetJson(urlStr, headers = {}, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const isHttps = u.protocol === 'https:';
      const reqFn = isHttps ? httpsRequest : httpRequest;

      const opts = {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'bags-shield/0.3',
          ...headers
        }
      };

      const req = reqFn(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* ignore */ }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, json, text });
        });
      });

      const timer = setTimeout(() => {
        req.destroy(new Error('timeout'));
      }, timeoutMs);

      req.on('error', (err) => {
        clearTimeout(timer);
        resolve({ status: 0, ok: false, error: String(err?.message || err) });
      });

      req.on('close', () => clearTimeout(timer));
      req.end();
    } catch (e) {
      resolve({ status: 0, ok: false, error: String(e?.message || e) });
    }
  });
}

/** Chama a Bags API se houver chave e base configuradas */
export async function getBagsTokenInfo({ mint, network = 'devnet' }) {
  if (!mint) return { ok: false, skipped: 'no_mint' };
  if (!hasBagsKey()) return { ok: false, skipped: 'no_api_key' };

  const base = process.env.BAGS_API_BASE || 'https://api.bags.app'; // ajuste conforme a doc da sua chave
  const url = `${base}/v1/tokens/${encodeURIComponent(mint)}?network=${encodeURIComponent(network)}`;

  const res = await httpGetJson(url, { Authorization: `Bearer ${process.env.BAGS_API_KEY}` }, TIMEOUT_MS);

  if (!res.ok) {
    return {
      ok: false,
      reason: res.error ? 'exception' : 'http_error',
      status: res.status,
      body: (res.text || '').slice(0, 500),
      error: res.error
    };
  }
  return { ok: true, raw: res.json ?? {} };
}

/**
 * Converte possíveis formatos da Bags em “hints” para nosso engine
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

  // Liquidez / lock
  const liquidityUsd = Number(pick(raw, ['liquidity.usd', 'market.liquidityUsd', 'metrics.liquidity.usd']));
  const liquidityLocked = !!pick(raw, ['liquidity.locked', 'locks.hasActiveLock', 'pool.locked']);

  // Holders top10
  const top10HoldersPct = Number(pick(raw, ['holders.top10.pct', 'ownership.top10Pct', 'distribution.top10Pct']));

  // Authorities
  const mintAuthActive = pick(raw, ['authorities.mint.active', 'mintAuthority.active', 'token.mintAuthorityActive']);
  const mintAuthRenounced = pick(raw, ['authorities.mint.renounced', 'mintAuthority.renounced']);
  const mintAuthorityActive = typeof mintAuthActive === 'boolean' ? mintAuthActive
    : typeof mintAuthRenounced === 'boolean' ? !mintAuthRenounced
    : undefined;

  const freezeAuthRenounced = pick(raw, ['authorities.freeze.renounced', 'freezeAuthority.renounced']);
  const freezeNotRenounced = typeof freezeAuthRenounced === 'boolean' ? !freezeAuthRenounced : undefined;

  // Idade do token
  const createdAt = pick(raw, ['createdAt', 'mintedAt', 'token.createdAt', 'metadata.createdAt']);
  let tokenAgeDays;
  if (createdAt) {
    const t = new Date(createdAt).getTime();
    if (!Number.isNaN(t)) {
      const diffMs = Date.now() - t;
      tokenAgeDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Socials
  const socials = pick(raw, ['socials', 'metadata.socials', 'links.social']);
  const socialsOk = Array.isArray(socials) ? socials.length > 0
    : socials && typeof socials === 'object' ? Object.values(socials).some(Boolean)
    : false;

  // Verificado / reputação
  const bagsVerified = !!pick(raw, ['verified', 'badges.verified', 'flags.verified']);
  let creatorReputation = pick(ra
