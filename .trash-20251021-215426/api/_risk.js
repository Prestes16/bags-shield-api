/** Lógica de risco (versão 2) */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function computeRisk(input = {}) {
  const network = String(input.network || '').toLowerCase();
  const mint = (input.mint ?? '').toString().trim();

  let score = 50;
  const reasons = [];

  // Network
  if (network === 'devnet') {
    score += 10;
    reasons.push('Network: devnet (ambiente de testes)');
  } else if (network === 'mainnet') {
    score = Math.max(score - 10, 0);
    reasons.push('Network: mainnet');
  } else if (network) {
    score += 15;
    reasons.push(`Network desconhecida: ${network}`);
  } else {
    score += 15;
    reasons.push('Network ausente');
  }

  // Mint
  if (!mint) {
    score += 30;
    reasons.push('Mint ausente');
  } else {
    const len = mint.length;
    const looksValid = BASE58.test(mint) && len >= 30 && len <= 50;
    if (!looksValid) {
      score += 20;
      reasons.push('Mint com formato atípico (base58/len)');
    }
  }

  // Mints conhecidos — heurísticas (ex.: wrapped SOL)
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
