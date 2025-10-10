import type { VercelRequest, VercelResponse } from "@vercel/node";
import { firstString, safeStartsWith } from "../../lib/safe";
import _core from "./core";

const core: any = ( (_core as any)?.default ?? _core );

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Authorization tolerante: usa se vier como Bearer, senão continua normal
  const auth = firstString(req.headers?.authorization);
  if (safeStartsWith(auth, "Bearer ")) {
    (req as any).authToken = auth!.slice(7).trim(); // "Bearer " => 7
  }
  return core(req, res);
}
