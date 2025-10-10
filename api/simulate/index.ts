import type { VercelRequest, VercelResponse } from "@vercel/node";
import { firstString, safeStartsWith } from "../../lib/safe";
import { parseOrBadRequest, contentTypeIssue } from "../../lib/validate";
import { TxParamsSchema } from "../../lib/schemas";
import _core from "./core";
const core: any = ((_core as any)?.default ?? _core);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Authorization tolerante
  const auth = firstString(req.headers?.authorization);
  if (safeStartsWith(auth, "Bearer ")) {
    (req as any).authToken = auth!.slice(7).trim();
  }

  if (req.method === "POST") {
    if (!safeStartsWith(req.headers?.["content-type"], "application/json")) {
      return res.status(400).json(contentTypeIssue("application/json"));
    }
    const r = parseOrBadRequest(TxParamsSchema, (req as any).body);
    if (!r.ok) return res.status(400).json(r);
    (req as any).validated = r.data;
  }

  return core(req, res);
}
