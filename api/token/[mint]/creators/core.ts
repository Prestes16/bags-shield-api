import type { VercelRequest } from '@vercel/node';

export default async function core(req: VercelRequest) {
  const mint = (req as any)?.query?.mint as string;
  // TODO: integrar Bags SDK: sdk.state.getTokenCreators(mint)
  return {
    mint,
    creators: [], // stub
  };
}