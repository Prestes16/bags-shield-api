export const BAGS_API_BASE =
  (process.env.BAGS_API_BASE ?? 'https://public-api-v2.bags.fm/api/v1/').replace(/\/?$/, '/');

export const BAGS_TIMEOUT_MS =
  Number.isFinite(Number(process.env.BAGS_TIMEOUT_MS)) ? Number(process.env.BAGS_TIMEOUT_MS) : 10000;

export const PROGRAMS = {
  FEE_CLAIMER: 'FEEhPbKVKnco9EXnaY3i4R5rQVUx91wgVfu8qokixywi',
  METEORA_DAMM_V2: 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
  METEORA_DBC: 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN',
} as const;

export const LUT_PUBLIC = 'Eq1EVs15EAWww1YtPTtWPzJRLPJoS6VYP9oW9SbNr3yp';