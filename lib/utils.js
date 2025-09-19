export function tierFromScore(score) {
  if (score >= 80) return 'EXTREME';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

export function nowISO() {
  return new Date().toISOString();
}

