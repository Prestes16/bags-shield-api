export const LAUNCHPAD_PUBLIC_WRITES_ENV = "LAUNCHPAD_PUBLIC_WRITES_ENABLED";
export const LAUNCHPAD_SAFE_MODE_PAUSED_CODE = "LAUNCHPAD_SAFE_MODE_PAUSED";
export const LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE =
  "Launchpad writes are paused while Bags Shield hardens the fee-share launch flow. No wallet signature or SOL-spending transaction will be requested until launch can be completed safely.";

function envEnabled(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function isLaunchpadPublicWritesEnabled() {
  return envEnabled(LAUNCHPAD_PUBLIC_WRITES_ENV);
}

export function isLaunchpadPublicWritesPaused() {
  return !isLaunchpadPublicWritesEnabled();
}
