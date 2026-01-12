import type { VercelRequest, VercelResponse } from "@vercel/node";
import { preflight, guardMethod, ensureRequestId } from "../lib/cors";
import { badRequest, ok } from "../lib/http";
import { getSimMode } from "../lib/env";

interface SimulateRequestBody {
  mint?: string;
}

function isBase58ish(s: unknown): s is string {
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    preflight(res, ["POST"]);
    return;
  }
  if (!guardMethod(req, res, ["POST"])) return;

  const requestId = ensureRequestId(res);
  const body = (req.body ?? {}) as SimulateRequestBody;
  const mint = body.mint;

  if (!isBase58ish(mint)) {
    badRequest(res, "mint field is missing or invalid.", requestId);
    return;
  }

  const score = 68;
  const grade =
    score >= 80 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
  const mode = getSimMode();

  ok(
    res,
    {
      isSafe: score >= 80,
      shieldScore: score,
      grade,
      warnings: [],
      metadata: { mode, mintLength: mint.length, base: null },
    },
    requestId,
    { mode }
  );
  return;
}
