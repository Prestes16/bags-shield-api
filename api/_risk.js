/** Lógica simples de risco (placeholder) */
export function computeRisk(input = {}) {
  const network = String(input.network || '').toLowerCase();
  const mint = String(input.mint || '').trim();

  let score = 50;
  const reasons = [];

  // Devnet = mais incerteza
  if (network === 'devnet') {
    score += 10;
    reasons.push('Network: devnet (ambiente de testes)');
  }

  // Mint conhecido (wrapped SOL) = reduz risco
  if (mint === 'So11111111111111111111111111111111111111112') {
    score = Math.max(score - 40, 0);
    reasons.push('Mint conhecido: Wrapped SOL');
  }

  // Clamp 0..100
  score = Math.max(0, Math.min(100, score));

  const label = score < 40 ? 'LOW' : score < 70 ? 'MEDIUM' : 'HIGH';
  const badges = [];
  if (label === 'LOW') badges.push({ id: 'low-risk', color: 'green', text: 'Baixo risco' });
  if (label === 'MEDIUM') badges.push({ id: 'med-risk', color: 'yellow', text: 'Risco médio' });
  if (label === 'HIGH') badges.push({ id: 'high-risk', color: 'red', text: 'Alto risco' });

  return { score, label, reasons, badges };
}
