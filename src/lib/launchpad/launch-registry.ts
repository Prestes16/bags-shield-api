const LAUNCHPAD_ORIGIN = "bags-shield-launchpad";

const REAL_LAUNCH_STATUSES = new Set([
  "token_info_created",
  "transaction_created",
  "submitted",
  "confirmed",
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
  launchStatus: "token_info_created" | "transaction_created" | "submitted" | "confirmed";
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

  if (!mint) return false;
  if (!truthy(row.app_created)) return false;
  if (origin !== LAUNCHPAD_ORIGIN) return false;
  if (!isFalse(row.is_demo) || !isFalse(row.is_imported)) return false;
  if (!creatorWallet && !launchWallet) return false;
  if (!status || !REAL_LAUNCH_STATUSES.has(status)) return false;

  if (status === "confirmed") {
    return Boolean(cleanString(row.tx_signature) && cleanString(row.confirmed_at));
  }

  return true;
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
