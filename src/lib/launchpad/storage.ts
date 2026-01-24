/**
 * LocalStorage utilities for Launchpad drafts and history
 */

import type { LaunchConfigDraft, ShieldProofManifest } from "./types";

const STORAGE_KEY_DRAFT = "launchpad.draft";
const STORAGE_KEY_HISTORY = "launchpad.history";

export interface HistoryEntry {
  mint: string;
  manifest: ShieldProofManifest;
  createdAt: string;
  config: LaunchConfigDraft;
}

/**
 * Save draft to localStorage
 */
export function saveDraft(draft: LaunchConfigDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft));
  } catch (error) {
    console.error("Failed to save draft:", error);
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraft(): LaunchConfigDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (!stored) return null;
    return JSON.parse(stored) as LaunchConfigDraft;
  } catch (error) {
    console.error("Failed to load draft:", error);
    return null;
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_DRAFT);
  } catch (error) {
    console.error("Failed to clear draft:", error);
  }
}

/**
 * Add entry to history
 */
export function addToHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const history = loadHistory();
    // Remove duplicate if exists (same mint)
    const filtered = history.filter((e) => e.mint !== entry.mint);
    const updated = [entry, ...filtered].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to add to history:", error);
  }
}

/**
 * Load history from localStorage
 */
export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    return JSON.parse(stored) as HistoryEntry[];
  } catch (error) {
    console.error("Failed to load history:", error);
    return [];
  }
}

/**
 * Get history entry by mint
 */
export function getHistoryEntry(mint: string): HistoryEntry | null {
  const history = loadHistory();
  return history.find((e) => e.mint === mint) || null;
}
