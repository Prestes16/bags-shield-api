import type { VercelRequest } from '@vercel/node';

export default async function core(req: VercelRequest) {
  const mint = (req as any)?.query?.mint as string;
    const { getTokenCreators } = await import("../../../../lib/bags.js");
  const creators = await getTokenCreators(mint);
  return { mint, creators };
}