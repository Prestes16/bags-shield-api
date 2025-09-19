import { tierFromScore } from './utils.js';

// Heurísticas simples para o MVP. Depois vamos trocar por dados reais (Bags API / Solana RPC).
export function computeRisk(input) {
  const { mint, metadata = {}, context = {} } = input;
  const badges = [];
  let score = 0;

  // 1) Nome/símbolo suspeitos
  const name = (metadata.name || '').toLowerCase();
  const symbol = (metadata.symbol || '').toLowerCase();
  const susWords = ['rug', 'scam', 'honeypot', 'pump', 'dump'];
  if (susWords.some(w => name.includes(w) || symbol.includes(w))) {
    score += 40; badges.push('SUS_NAME');
  }

  // 2) Liquidez (placeholder)
  const liquidityUsd = Number(metadata.liquidityUsd ?? 0);
  if (liquidityUsd < 500) { score += 25; badges.push('LOW_LIQ'); }

  // 3) Autoridades de mint/freeze (placeholders booleanos)
  if (metadata.mintAuthority === true) { score += 20; badges.push('MINT_AUTH'); }
  if (metadata.freezeAuthority === true) { score += 10; badges.push('FREEZE_AUTH'); }

  // 4) Idade do criador/projeto (dias)
  const creatorAgeDays = Number(metadata.creatorAgeDays ?? 0);
  if (creatorAgeDays < 30) { score += 15; badges.push('NEW_CREATOR'); }

  // 5) Concentração de holders (Top10)
  const top10Pct = Number(metadata.top10Pct ?? 0);
  if (top10Pct >= 50) { score += 30; badges.push('HOLDER_CONCENTRATION'); }

  // 6) Falta de sociais/verificação
  const hasSocials = Boolean(metadata.socialsOk);
  if (!hasSocials) { score += 10; badges.push('NO_SOCIALS'); }

  // 7) Sinal verde se verificado pela Bags (placeholder)
  if (metadata.bagsVerified === true) {
    score = Math.max(0, score - 20);
    badges.push('BAGS_VERIFIED');
  }

  // Limites
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const tier = tierFromScore(score);

  // Sugestões de cores para UI (tema dark)
  const ui = {
    tierColor:
      tier === 'LOW' ? '#00FFA3' :
      tier === 'MEDIUM' ? '#FFD166' :
      tier === 'HIGH' ? '#FF7B00' : '#FF3B3B',
    badgeColors: {
      SUS_NAME: '#FF3B3B',
      LOW_LIQ: '#FF7B00',
      MINT_AUTH: '#FF7B00',
      FREEZE_AUTH: '#FFD166',
      NEW_CREATOR: '#FFD166',
      HOLDER_CONCENTRATION: '#FF3B3B',
      NO_SOCIALS: '#9CA3AF',
      BAGS_VERIFIED: '#00FFA3'
    }
  };

  return {
    score,
    tier,
    badges,
    ui,
    details: {
      mint,
      name: metadata.name || null,
      symbol: metadata.symbol || null,
      liquidityUsd,
      mintAuthority: Boolean(metadata.mintAuthority),
      freezeAuthority: Boolean(metadata.freezeAuthority),
      creatorAgeDays,
      top10Pct,
      socialsOk: hasSocials,
      bagsVerified: Boolean(metadata.bagsVerified),
      context
    }
  };
}

