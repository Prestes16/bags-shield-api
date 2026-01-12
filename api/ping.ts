import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({
    success: true,
    message: 'pong',
    time: new Date().toISOString(),
  });
}
