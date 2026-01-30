// Watchlist Storage using localStorage with sync across tabs

export interface WatchlistToken {
  mint: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  hasAlerts: boolean;
  addedAt: number;
  // Cached scan data
  lastScanned?: number;
  score?: number;
  grade?: string;
  isSafe?: boolean;
  riskLabel?: "low" | "medium" | "high" | "critical";
}

const WATCHLIST_KEY = "bags-shield-watchlist";
const MAX_WATCHLIST_SIZE = 50;

/**
 * Get all watchlist tokens
 */
export function getWatchlist(): WatchlistToken[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(WATCHLIST_KEY);
    if (!data) return [];

    const tokens = JSON.parse(data) as WatchlistToken[];
    // Sort by most recently added
    return tokens.sort((a, b) => b.addedAt - a.addedAt);
  } catch (error) {
    console.error("[v0] Error reading watchlist:", error);
    return [];
  }
}

/**
 * Add token to watchlist
 */
export function addToWatchlist(token: Omit<WatchlistToken, "addedAt">): boolean {
  if (typeof window === "undefined") return false;

  try {
    const watchlist = getWatchlist();

    // Check if already exists
    if (watchlist.some((t) => t.mint === token.mint)) {
      console.log("[v0] Token already in watchlist");
      return false;
    }

    // Check max size
    if (watchlist.length >= MAX_WATCHLIST_SIZE) {
      console.error("[v0] Watchlist is full");
      return false;
    }

    // Add token
    const newToken: WatchlistToken = {
      ...token,
      addedAt: Date.now(),
    };

    watchlist.push(newToken);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));

    // Dispatch event for cross-tab sync
    window.dispatchEvent(new Event("watchlist-updated"));

    return true;
  } catch (error) {
    console.error("[v0] Error adding to watchlist:", error);
    return false;
  }
}

/**
 * Remove token from watchlist
 */
export function removeFromWatchlist(mint: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const watchlist = getWatchlist();
    const filtered = watchlist.filter((t) => t.mint !== mint);

    if (filtered.length === watchlist.length) {
      return false; // Token not found
    }

    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("watchlist-updated"));

    return true;
  } catch (error) {
    console.error("[v0] Error removing from watchlist:", error);
    return false;
  }
}

/**
 * Update token alerts
 */
export function toggleTokenAlerts(mint: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const watchlist = getWatchlist();
    const token = watchlist.find((t) => t.mint === mint);

    if (!token) return false;

    token.hasAlerts = !token.hasAlerts;
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    window.dispatchEvent(new Event("watchlist-updated"));

    return true;
  } catch (error) {
    console.error("[v0] Error toggling alerts:", error);
    return false;
  }
}

/**
 * Update token scan data
 */
export function updateTokenScanData(
  mint: string,
  scanData: {
    score: number;
    grade: string;
    isSafe: boolean;
    riskLabel: "low" | "medium" | "high" | "critical";
  }
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const watchlist = getWatchlist();
    const token = watchlist.find((t) => t.mint === mint);

    if (!token) return false;

    token.lastScanned = Date.now();
    token.score = scanData.score;
    token.grade = scanData.grade;
    token.isSafe = scanData.isSafe;
    token.riskLabel = scanData.riskLabel;

    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    window.dispatchEvent(new Event("watchlist-updated"));

    return true;
  } catch (error) {
    console.error("[v0] Error updating scan data:", error);
    return false;
  }
}

/**
 * Check if token is in watchlist
 */
export function isInWatchlist(mint: string): boolean {
  const watchlist = getWatchlist();
  return watchlist.some((t) => t.mint === mint);
}

/**
 * Get watchlist count
 */
export function getWatchlistCount(): number {
  return getWatchlist().length;
}

/**
 * Clear entire watchlist
 */
export function clearWatchlist(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(WATCHLIST_KEY);
  window.dispatchEvent(new Event("watchlist-updated"));
}
