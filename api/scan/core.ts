import type { VercelRequest } from '@vercel/node';

export default async function core(req: VercelRequest) {
  const query = (req as any).query ?? {};
  return { note: 'scan-ok', query };
}