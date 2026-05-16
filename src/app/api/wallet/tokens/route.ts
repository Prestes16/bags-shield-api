/**
 * GET /api/wallet/tokens?wallet=<pubkey>
 * Retorna os tokens SPL (fungíveis) da carteira via Helius DAS getAssetsByOwner.
 * Inclui SOL nativo, símbolos, decimais, balance e logoURI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHeliusRpcUrl } from '@/lib/helius';
import {
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  getOrGenerateRequestId,
} from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 60 };

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const QuerySchema = z.object({
  wallet: z
    .string()
    .trim()
    .min(32)
    .max(44)
    .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid wallet address'),
});

export interface WalletToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;        // valor humano (já dividido pelos decimais)
  rawBalance: string;     // string do amount bruto
  logoURI?: string;
  verified: boolean;
  isNative: boolean;      // true = SOL nativo
}

export interface WalletTokensResponse {
  success: true;
  wallet: string;
  tokens: WalletToken[];
  nativeSOL: number;
  meta: { requestId: string; latencyMs: number };
}

export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = getClientIp(req.headers);

  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'wallet-tokens', RATE_LIMIT);
  if (!allowed) {
    const res = NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.' } },
      { status: 429 },
    );
    applyCorsHeaders(req, res);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ wallet: searchParams.get('wallet') });

  if (!parsed.success) {
    const res = NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid wallet', meta: { requestId } },
      { status: 400 },
    );
    applyCorsHeaders(req, res);
    return res;
  }

  const { wallet } = parsed.data;
  const rpcUrl = getHeliusRpcUrl();

  if (!rpcUrl) {
    const res = NextResponse.json(
      { success: false, error: 'Helius RPC not configured', meta: { requestId } },
      { status: 503 },
    );
    applyCorsHeaders(req, res);
    return res;
  }

  const t0 = Date.now();

  try {
    // ── 1. Busca assets fungíveis via DAS getAssetsByOwner ──────────────────
    const dasBody = JSON.stringify({
      jsonrpc: '2.0',
      id: 'wallet-tokens',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: wallet,
        page: 1,
        limit: 100,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true,
        },
      },
    });

    const dasRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dasBody,
      signal: AbortSignal.timeout(8_000),
    });

    if (!dasRes.ok) {
      throw new Error(`Helius DAS HTTP ${dasRes.status}`);
    }

    const dasJson = (await dasRes.json()) as {
      result?: {
        items?: unknown[];
        nativeBalance?: { lamports?: number; price_per_sol?: number };
        total?: number;
      };
      error?: { code?: number; message?: string };
    };

    if (dasJson.error) {
      throw new Error(`DAS error: ${dasJson.error.message ?? dasJson.error.code}`);
    }

    const items = dasJson.result?.items ?? [];
    const nativeLamports = dasJson.result?.nativeBalance?.lamports ?? 0;
    const nativeSOL = nativeLamports / 1e9;

    // ── 2. Mapeia tokens fungíveis ──────────────────────────────────────────
    const tokens: WalletToken[] = [];

    // SOL nativo como primeiro item
    if (nativeSOL > 0) {
      tokens.push({
        mint: SOL_MINT,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        balance: nativeSOL,
        rawBalance: String(nativeLamports),
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        verified: true,
        isNative: true,
      });
    }

    for (const item of items) {
      const asset = item as Record<string, unknown>;

      // Filtra apenas tokens fungíveis (interface: FungibleToken ou FungibleAsset)
      const iface = String(asset.interface ?? '');
      if (!iface.includes('Fungible') && iface !== 'V1_NFT') continue;
      if (iface === 'V1_NFT' || iface === 'NonFungible' || iface === 'ProgrammableNFT') continue;

      const mint = String(asset.id ?? '');
      if (!mint || mint.length < 32) continue;

      // token_info contém balance, decimais, symbol
      const tokenInfo = (asset.token_info ?? {}) as Record<string, unknown>;
      const rawAmount = tokenInfo.balance ?? tokenInfo.amount ?? 0;
      const decimals = Number(tokenInfo.decimals ?? 0);
      const symbol = String(tokenInfo.symbol ?? '').trim() || 'UNKNOWN';

      const rawBalance = String(rawAmount);
      const balance = Number(rawAmount) / Math.pow(10, decimals);

      // Ignora tokens com saldo zero
      if (balance <= 0) continue;

      // Metadata
      const content = (asset.content ?? {}) as Record<string, unknown>;
      const metadata = (content.metadata ?? {}) as Record<string, unknown>;
      const name = String(metadata.name ?? symbol).trim();

      // Logo
      const files = (content.files ?? []) as Array<Record<string, unknown>>;
      const links = (content.links ?? {}) as Record<string, unknown>;
      let logoURI: string | undefined =
        String(links.image ?? links.logo ?? '').trim() || undefined;
      if (!logoURI && files.length > 0) {
        logoURI = String(files[0]?.uri ?? '').trim() || undefined;
      }

      // Verificação: token listado pela Jupiter / token authority vazia
      const authorities = (asset.authorities ?? []) as Array<Record<string, unknown>>;
      const mintAuthority = authorities.find((a) => a.scope === 'mint' || (Array.isArray(a.scopes) && (a.scopes as string[]).includes('mint')));
      const verified = !mintAuthority; // mint authority queimada = verificado

      tokens.push({
        mint,
        symbol,
        name,
        decimals,
        balance,
        rawBalance,
        logoURI,
        verified,
        isNative: false,
      });
    }

    // Ordena: SOL primeiro, depois por balance decrescente
    tokens.sort((a, b) => {
      if (a.isNative) return -1;
      if (b.isNative) return 1;
      return b.balance - a.balance;
    });

    const latencyMs = Date.now() - t0;
    const res = NextResponse.json<WalletTokensResponse>(
      {
        success: true,
        wallet,
        tokens,
        nativeSOL,
        meta: { requestId, latencyMs },
      },
      {
        status: 200,
        headers: { 'X-Request-Id': requestId, 'X-RateLimit-Remaining': String(remaining - 1) },
      },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[wallet/tokens] ${msg}`);
    const res = NextResponse.json(
      { success: false, error: msg, meta: { requestId } },
      { status: 502, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }
}
