/**
 * Simple in-memory circuit breaker per key.
 * After N consecutive failures, open for cooldownMs; then half-open (one trial).
 */

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 60_000; // 1 min

const state = new Map<string, { failures: number; openedAt: number; state: 'closed' | 'open' | 'half-open' }>();

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

/**
 * Returns true if the call is allowed (circuit closed or half-open).
 */
export function circuitAllow(key: string, options: CircuitBreakerOptions = {}): boolean {
  const { failureThreshold = DEFAULT_FAILURE_THRESHOLD, cooldownMs = DEFAULT_COOLDOWN_MS } = options;
  const now = Date.now();
  let entry = state.get(key);

  if (!entry) {
    state.set(key, { failures: 0, openedAt: 0, state: 'closed' });
    return true;
  }

  if (entry.state === 'closed') return true;

  if (entry.state === 'open') {
    if (now - entry.openedAt >= cooldownMs) {
      entry.state = 'half-open';
      entry.failures = 0;
      return true;
    }
    return false;
  }

  // half-open: allow one trial
  return true;
}

/**
 * Record success: reset failures and close if was half-open.
 */
export function circuitSuccess(key: string): void {
  const entry = state.get(key);
  if (!entry) return;
  entry.failures = 0;
  entry.state = 'closed';
}

/**
 * Record failure: increment; open circuit if threshold reached.
 */
export function circuitFailure(key: string, options: CircuitBreakerOptions = {}): void {
  const { failureThreshold = DEFAULT_FAILURE_THRESHOLD, cooldownMs = DEFAULT_COOLDOWN_MS } = options;
  let entry = state.get(key);
  if (!entry) {
    entry = { failures: 0, openedAt: 0, state: 'closed' };
    state.set(key, entry);
  }

  entry.failures++;
  if (entry.state === 'half-open') {
    entry.state = 'open';
    entry.openedAt = Date.now();
    return;
  }
  if (entry.failures >= failureThreshold) {
    entry.state = 'open';
    entry.openedAt = Date.now();
  }
}

export function circuitState(key: string): 'closed' | 'open' | 'half-open' | undefined {
  return state.get(key)?.state;
}
