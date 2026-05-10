/**
 * Auth persistence via Supabase REST.
 *
 * Required Supabase tables:
 *
 * Tables: auth_users, oauth_accounts, linked_wallets
 * (auth_users is separate from the payment `users` table)
 */

function getSupabase(): { url: string; headers: Record<string, string> } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/+$/, "") + "/rest/v1",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
  };
}

// ── OAuth user ───────────────────────────────────────────────────────────

export async function findOrCreateUserByOAuth(
  provider: "google" | "twitter",
  sub: string,
  profile: { email?: string; name?: string; picture?: string }
): Promise<{ userId: string; isNew: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  // 1. Check if oauth_account already exists
  const existing = await fetch(
    `${sb.url}/oauth_accounts?provider=eq.${provider}&provider_sub=eq.${sub}&select=user_id&limit=1`,
    { headers: sb.headers }
  );
  const rows = (await existing.json()) as Array<{ user_id: string }>;
  if (rows.length > 0) {
    // Update profile
    await fetch(`${sb.url}/auth_users?id=eq.${rows[0].user_id}`, {
      method: "PATCH",
      headers: { ...sb.headers, prefer: "return=minimal" },
      body: JSON.stringify({
        display_name: profile.name ?? null,
        email: profile.email ?? null,
        avatar_url: profile.picture ?? null,
      }),
    });
    return { userId: rows[0].user_id, isNew: false };
  }

  // 2. Check if user exists by email (link existing account)
  if (profile.email) {
    const byEmail = await fetch(
      `${sb.url}/auth_users?email=eq.${encodeURIComponent(profile.email)}&select=id&limit=1`,
      { headers: sb.headers }
    );
    const emailRows = (await byEmail.json()) as Array<{ id: string }>;
    if (emailRows.length > 0) {
      await fetch(`${sb.url}/oauth_accounts`, {
        method: "POST",
        headers: { ...sb.headers, prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: emailRows[0].id,
          provider,
          provider_sub: sub,
        }),
      });
      return { userId: emailRows[0].id, isNew: false };
    }
  }

  // 3. Create new user + oauth_account
  const createRes = await fetch(`${sb.url}/auth_users`, {
    method: "POST",
    headers: { ...sb.headers, prefer: "return=representation" },
    body: JSON.stringify({
      display_name: profile.name ?? null,
      email: profile.email ?? null,
      avatar_url: profile.picture ?? null,
    }),
  });
  const created = (await createRes.json()) as Array<{ id: string }>;
  const userId = created[0]?.id;
  if (!userId) throw new Error("Failed to create user");

  await fetch(`${sb.url}/oauth_accounts`, {
    method: "POST",
    headers: { ...sb.headers, prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, provider, provider_sub: sub }),
  });

  return { userId, isNew: true };
}

// ── Wallet user ──────────────────────────────────────────────────────────

export async function findOrCreateUserByWallet(
  address: string
): Promise<{ userId: string; isNew: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  // Check if wallet already linked
  const existing = await fetch(
    `${sb.url}/linked_wallets?address=eq.${address}&select=user_id&limit=1`,
    { headers: sb.headers }
  );
  const rows = (await existing.json()) as Array<{ user_id: string }>;
  if (rows.length > 0) {
    return { userId: rows[0].user_id, isNew: false };
  }

  // Create new user + link wallet
  const createRes = await fetch(`${sb.url}/auth_users`, {
    method: "POST",
    headers: { ...sb.headers, prefer: "return=representation" },
    body: JSON.stringify({ display_name: `${address.slice(0, 4)}...${address.slice(-4)}` }),
  });
  const created = (await createRes.json()) as Array<{ id: string }>;
  const userId = created[0]?.id;
  if (!userId) throw new Error("Failed to create user");

  await fetch(`${sb.url}/linked_wallets`, {
    method: "POST",
    headers: { ...sb.headers, prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, address }),
  });

  return { userId, isNew: true };
}

// ── Link wallet to existing user ─────────────────────────────────────────

export async function linkWalletToUser(
  userId: string,
  address: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  // Check if already linked
  const existing = await fetch(
    `${sb.url}/linked_wallets?address=eq.${address}&select=id&limit=1`,
    { headers: sb.headers }
  );
  const rows = (await existing.json()) as Array<{ id: string }>;
  if (rows.length > 0) return; // already linked

  await fetch(`${sb.url}/linked_wallets`, {
    method: "POST",
    headers: { ...sb.headers, prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, address }),
  });
}

// ── Get user profile ─────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<{
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  wallets: string[];
  oauthProviders: string[];
} | null> {
  const sb = getSupabase();
  if (!sb) return null;

  // Fetch user
  const userRes = await fetch(
    `${sb.url}/auth_users?id=eq.${userId}&select=id,display_name,email,avatar_url&limit=1`,
    { headers: sb.headers }
  );
  const users = (await userRes.json()) as Array<{
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  }>;
  if (!users.length) return null;

  // Fetch wallets
  const walletsRes = await fetch(
    `${sb.url}/linked_wallets?user_id=eq.${userId}&select=address`,
    { headers: sb.headers }
  );
  const wallets = (await walletsRes.json()) as Array<{ address: string }>;

  // Fetch oauth providers
  const oauthRes = await fetch(
    `${sb.url}/oauth_accounts?user_id=eq.${userId}&select=provider`,
    { headers: sb.headers }
  );
  const oauths = (await oauthRes.json()) as Array<{ provider: string }>;

  return {
    userId: users[0].id,
    displayName: users[0].display_name,
    email: users[0].email,
    avatarUrl: users[0].avatar_url,
    wallets: wallets.map((w) => w.address),
    oauthProviders: [...new Set(oauths.map((o) => o.provider))],
  };
}
