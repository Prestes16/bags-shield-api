export interface ScanHistoryItem {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  score: number;
  grade: string;
  timestamp: number;
  isSafe: boolean;
}

const SCAN_HISTORY_KEY = "bags_shield_scan_history";
const HISTORY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function addScanToHistory(item: Omit<ScanHistoryItem, "timestamp">) {
  if (typeof window === "undefined") return;

  try {
    const history = getScanHistory();
    
    // Remove old entry if exists for same mint
    const filtered = history.filter((h) => h.mint !== item.mint);
    
    // Add new entry with current timestamp
    const newItem: ScanHistoryItem = {
      ...item,
      timestamp: Date.now(),
    };
    
    // Add to beginning of array
    filtered.unshift(newItem);
    
    // Keep only last 50 scans
    const limited = filtered.slice(0, 50);
    
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error("[v0] Failed to save scan history:", error);
  }
}

export function getScanHistory(): ScanHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!stored) return [];
    
    const history: ScanHistoryItem[] = JSON.parse(stored);
    const now = Date.now();
    
    // Filter out scans older than 24 hours
    const filtered = history.filter((item) => {
      const age = now - item.timestamp;
      return age < HISTORY_DURATION_MS;
    });
    
    // Update storage if we filtered anything out
    if (filtered.length !== history.length) {
      localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filtered));
    }
    
    return filtered;
  } catch (error) {
    console.error("[v0] Failed to load scan history:", error);
    return [];
  }
}

export function clearScanHistory() {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(SCAN_HISTORY_KEY);
  } catch (error) {
    console.error("[v0] Failed to clear scan history:", error);
  }
}

export function getRecentScansCount(): number {
  return getScanHistory().length;
}
