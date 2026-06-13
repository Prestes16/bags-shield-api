const LAUNCHPAD_ORIGIN = "bags-shield-launchpad";

const REAL_LAUNCH_STATUSES = new Set([
  "confirmed",
  "launched",
]);

export interface SupabaseRest {
  base: string;
  headers: Record<string, string>;
}

export interface UserLaunchRow {
  mint?: string | null;
  name?: string | null;
  symbol?: string | null;
  image_url?: string | null;
  created_at?: string | null;
  creator_wallet?: string | null;
  launch_wallet?: string | null;
  tx_signature?: string | null;
  launch_status?: string | null;
  origin?: string | null;
  app_created?: boolean | string | null;
  is_demo?: boolean | string | null;
  is_imported?: boolean | string | null;
  confirmed_at?: string | null;
  metadata_uri?: string | null;
  config_key?: string | null;
}

export interface LaunchFeedItem {
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  created_at: string;
  creatorWallet: string | null;
  launchWallet: string | null;
  launchStatus: string;
  txSignature: string | null;
  confirmedAt: string | null;
  metadataUri: string | null;
  configKey: string | null;
  launchSource: "bags-shield";
}

export interface LaunchProvenanceInput {
  mint: string;
  name?: string | null;
  symbol?: string | null;
  imageUrl?: string | null;
  creatorWallet?: string | null;
  launchWallet?: string | null;
  metadataUri?: string | null;
  configKey?: string | null;
  launchStatus: "token_info_created" | "config_created" | "transaction_created" | "submitted" | "confirmed" | "launched";
  txSignature?: string | null;
  confirmedAt?: string | null;
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function truthy(value: unknown) {
  return value === true || value === "true";
}

function isFalse(value: unknown) {
  return value === false || value === "false" || value === null || value === undefined;
}

export function getSupabaseRest(): SupabaseRest | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return {
    base: url.replace(/\/+$/, "") + "/rest/v1",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
  };
}

export function isRealBagsShieldLaunch(row: UserLaunchRow) {
  const mint = cleanString(row.mint);
  const origin = cleanString(row.origin);
  const status = cleanString(row.launch_status);
  const creatorWallet = cleanString(row.creator_wallet);
  const launchWallet = cleanString(row.launch_wallet);
  const txSignature = cleanString(row.tx_signature);
  const confirmedAt = cleanString(row.confirmed_at);

  if (!mint) return false;
  if (!truthy(row.app_created)) return false;
  if (origin !== LAUNCHPAD_ORIGIN) return false;
  if (!isFalse(row.is_demo) || !isFalse(row.is_imported)) return false;
  if (!creatorWallet && !launchWallet) return false;
  if (!status || !REAL_LAUNCH_STATUSES.has(status)) return false;
  return Boolean(txSignature && confirmedAt);
}

export function mapDbLaunchToFeedItem(row: UserLaunchRow): LaunchFeedItem | null {
  if (!isRealBagsShieldLaunch(row)) return null;

  return {
    mint: cleanString(row.mint) as string,
    name: cleanString(row.name),
    symbol: cleanString(row.symbol),
    image_url: cleanString(row.image_url),
    created_at: cleanString(row.created_at) || new Date(0).toISOString(),
    creatorWallet: cleanString(row.creator_wallet),
    launchWallet: cleanString(row.launch_wallet),
    launchStatus: cleanString(row.launch_status) as string,
    txSignature: cleanString(row.tx_signature),
    confirmedAt: cleanString(row.confirmed_at),
    metadataUri: cleanString(row.metadata_uri),
    configKey: cleanString(row.config_key),
    launchSource: "bags-shield",
  };
}

function withoutNullish<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

async function hasExistingLaunch(sb: SupabaseRest, mint: string) {
  const url = `${sb.base}/user_launches?select=mint&mint=eq.${encodeURIComponent(mint)}&limit=1`;
  const res = await fetch(url, { headers: sb.headers, cache: "no-store" });
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ mint?: string }>;
  return rows.length > 0;
}

export async function upsertUserLaunchProvenance(input: LaunchProvenanceInput) {
  const sb = getSupabaseRest();
  const mint = cleanString(input.mint);
  if (!sb || !mint) return false;

  const now = new Date().toISOString();
  const payload = withoutNullish({
    mint,
    name: cleanString(input.name),
    symbol: cleanString(input.symbol),
    image_url: cleanString(input.imageUrl),
    creator_wallet: cleanString(input.creatorWallet) || cleanString(input.launchWallet),
    launch_wallet: cleanString(input.launchWallet) || cleanString(input.creatorWallet),
    tx_signature: cleanString(input.txSignature),
    launch_status: input.launchStatus,
    origin: LAUNCHPAD_ORIGIN,
    app_created: true,
    is_demo: false,
    is_imported: false,
    confirmed_at: cleanString(input.confirmedAt),
    metadata_uri: cleanString(input.metadataUri),
    config_key: cleanString(input.configKey),
    updated_at: now,
  });

  try {
    const exists = await hasExistingLaunch(sb, mint);
    if (exists) {
      const patchRes = await fetch(`${sb.base}/user_launches?mint=eq.${encodeURIComponent(mint)}`, {
        method: "PATCH",
        headers: { ...sb.headers, prefer: "return=minimal" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      return patchRes.ok;
    }

    const postRes = await fetch(`${sb.base}/user_launches`, {
      method: "POST",
      headers: { ...sb.headers, prefer: "return=minimal" },
      body: JSON.stringify({
        ...payload,
        created_at: now,
      }),
      cache: "no-store",
    });
    return postRes.ok;
  } catch {
    return false;
  }
}

/**
 * PAID_SETUP_RECOVERY: lê a provenance persistida de um launch pelo mint para
 * recuperar o config_key salvo quando o create-config original foi pago.
 * Read-only; retorna null quando o registro/Supabase não está disponível.
 */
export async function getLaunchProvenanceByMint(mint: string): Promise<{
  configKey: string | null;
  metadataUri: string | null;
  launchStatus: string | null;
  creatorWallet: string | null;
  launchWallet: string | null;
} | null> {
  const sb = getSupabaseRest();
  const cleanMint = cleanString(mint);
  if (!sb || !cleanMint) return null;

  try {
    const url = `${sb.base}/user_launches?select=config_key,metadata_uri,launch_status,creator_wallet,launch_wallet&mint=eq.${encodeURIComponent(cleanMint)}&limit=1`;
    const res = await fetch(url, { headers: sb.headers, cache: "no-store" });
    if (!res.ok) return null;
    const rows = (await res.json()) as UserLaunchRow[];
    if (!rows.length) return null;
    return {
      configKey: cleanString(rows[0].config_key),
      metadataUri: cleanString(rows[0].metadata_uri),
      launchStatus: cleanString(rows[0].launch_status),
      creatorWallet: cleanString(rows[0].creator_wallet),
      launchWallet: cleanString(rows[0].launch_wallet),
    };
  } catch {
    return null;
  }
}

export type OwnedProvenanceResult =
  | { status: "unavailable" }
  | { status: "none" }
  | { status: "other_wallet" }
  | {
      status: "owned";
      configKey: string | null;
      metadataUri: string | null;
      launchStatus: string | null;
      creatorWallet: string | null;
      launchWallet: string | null;
    };

/**
 * RECOVERY_OWNERSHIP_GATE: registry provenance must belong to the requesting wallet
 *
 * Lookup de provenance com vínculo OBRIGATÓRIO de ownership:
 *   mint == baseMint AND (creator_wallet == wallet OR launch_wallet == wallet).
 * Provenance de mesmo mint pertencente a OUTRA wallet nunca é aceita como
 * fonte autoritativa — retorna "other_wallet" para a rota bloquear.
 */
export async function getLaunchProvenanceByMintAndWallet(
  mint: string,
  wallet: string,
): Promise<OwnedProvenanceResult> {
  const sb = getSupabaseRest();
  const cleanMint = cleanString(mint);
  const cleanWallet = cleanString(wallet);
  if (!sb || !cleanMint || !cleanWallet) return { status: "unavailable" };

  const row = await getLaunchProvenanceByMint(cleanMint);
  if (row === null) {
    // Distingue "sem registro" de "registro indisponível": refaz uma checagem
    // mínima de existência para não mascarar erro de Supabase como "none".
    try {
      const url = `${sb.base}/user_launches?select=mint&mint=eq.${encodeURIComponent(cleanMint)}&limit=1`;
      const res = await fetch(url, { headers: sb.headers, cache: "no-store" });
      if (!res.ok) return { status: "unavailable" };
      const rows = (await res.json()) as Array<{ mint?: string }>;
      return rows.length ? { status: "unavailable" } : { status: "none" };
    } catch {
      return { status: "unavailable" };
    }
  }

  const ownerWallets = [row.creatorWallet, row.launchWallet].filter(Boolean);
  if (ownerWallets.length === 0) {
    // Registro sem ownership gravado: não dá para provar posse — trata como
    // não-confiável para fins de fonte autoritativa.
    return { status: "none" };
  }
  if (!ownerWallets.includes(cleanWallet)) {
    return { status: "other_wallet" };
  }
  return { status: "owned", ...row };
}

export interface GuardedUpsertResult {
  persisted: boolean;
  conflict: boolean;
  reason?: string;
}

/**
 * RECOVERY_OWNERSHIP_GATE + DURABLE_PROVENANCE_BEFORE_SIGNATURE:
 * upsert que NUNCA sobrescreve ownership (creator_wallet/launch_wallet) nem
 * config_key de um registro existente incompatível. Retorna o resultado real
 * da persistência — o chamador decide se pode prosseguir.
 */
export async function upsertOwnedLaunchProvenance(
  input: LaunchProvenanceInput & { requestingWallet: string },
): Promise<GuardedUpsertResult> {
  const mint = cleanString(input.mint);
  const wallet = cleanString(input.requestingWallet);
  if (!mint || !wallet) return { persisted: false, conflict: false, reason: "invalid_input" };

  const existing = await getLaunchProvenanceByMint(mint);
  if (existing) {
    const owners = [existing.creatorWallet, existing.launchWallet].filter(Boolean);
    if (owners.length > 0 && !owners.includes(wallet)) {
      return { persisted: false, conflict: true, reason: "ownership_mismatch" };
    }
    const incomingKey = cleanString(input.configKey);
    if (existing.configKey && incomingKey && existing.configKey !== incomingKey) {
      return { persisted: false, conflict: true, reason: "config_key_mismatch" };
    }
  }

  const persisted = await upsertUserLaunchProvenance({
    ...input,
    // Preserva ownership existente: nunca troca as wallets de um registro.
    creatorWallet: existing?.creatorWallet || input.creatorWallet,
    launchWallet: existing?.launchWallet || input.launchWallet,
    configKey: existing?.configKey || input.configKey,
  });
  return { persisted, conflict: false };
}

export async function updateUserLaunchSubmitted(input: {
  mint?: string | null;
  wallet?: string | null;
  txSignature: string;
}) {
  const mint = cleanString(input.mint);
  const wallet = cleanString(input.wallet);
  if (!mint) return false;

  return upsertUserLaunchProvenance({
    mint,
    creatorWallet: wallet,
    launchWallet: wallet,
    txSignature: input.txSignature,
    launchStatus: "submitted",
  });
}

export async function updateUserLaunchConfirmed(input: {
  mint?: string | null;
  wallet?: string | null;
  txSignature: string;
  confirmedAt?: string | null;
}) {
  const mint = cleanString(input.mint);
  const wallet = cleanString(input.wallet);
  if (!mint) return false;

  return upsertUserLaunchProvenance({
    mint,
    creatorWallet: wallet,
    launchWallet: wallet,
    txSignature: input.txSignature,
    confirmedAt: input.confirmedAt || new Date().toISOString(),
    launchStatus: "confirmed",
  });
}
