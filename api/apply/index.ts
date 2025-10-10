import type { VercelRequest, VercelResponse } from "@vercel/node";
import { firstString, safeStartsWith } from "../../lib/safe";
import _core from "./core";

const core: any = ( (_core as any)?.default ?? _core );

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Guard de Authorization seguro
  const auth = firstString(req.headers?.authorization);
  if (!safeStartsWith(auth, "Bearer ")) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", reason: "MISSING_BEARER" });
  }

  // Disponibiliza o token para o core, sem remover o header original
  (req as any).authToken = auth!.slice(7).trim(); // "Bearer ".length === 7

  // Entrega para a lógica original (teu código antigo)
  return core(req, res);
}
