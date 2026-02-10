import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from "../../lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res); noStore(res);
  if (req.method === "OPTIONS") return preflight(res, ["POST"]);
  if (!guardMethod(req, res, ["POST"])) return;

  const requestId = ensureRequestId(res);
  try {
    return res.status(200).json({ success: true, response: { applied: true }, meta: { requestId } });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: "internal_error", details: String(err?.message ?? err), meta: { requestId } });
  }
}