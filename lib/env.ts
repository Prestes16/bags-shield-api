export function getSimMode(): string {
  return process.env.SIM_MODE || 'mock';
}

export function getCorsOrigins(): string[] | string {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return '*';
  if (raw.includes(',')) return raw.split(',').map((s) => s.trim());
  return raw.trim();
}
