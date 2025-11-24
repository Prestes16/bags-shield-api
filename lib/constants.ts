export const BAGS_API_BASE: string = (process.env.BAGS_API_BASE ?? "").trim();

/**
 * Timeout padrão (em ms) para chamadas HTTP ao upstream Bags.
 * Se a env estiver vazia/ruim, cai para 5000 ms (5s).
 */
export const BAGS_TIMEOUT_MS: number = (() => {
  const raw = (process.env.BAGS_TIMEOUT_MS ?? "").trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return parsed;
})();

/**
 * LUT pública sugerida para tips/fee share.
 * Pode ser ajustada no futuro sem quebrar o contrato da API.
 */
export const BAGS_LUT = "Eq1EVs15EAWww1YtPTtWPzJRLPJoS6VYP9oW9SbNr3yp" as const;

/**
 * IDs de programas relevantes para o ecossistema Bags/Meteora.
 * Placeholders por enquanto – serão atualizados quando
 * os IDs oficiais forem consolidados na documentação.
 */
export const PROGRAMS = {
  FEE_CLAIMER: "FeeClaimer11111111111111111111111111111111",
  METEORA_DBC: "MeteoraDbc111111111111111111111111111111",
  METEORA_DAMM: "MeteoraDamm1111111111111111111111111111",
} as const;
