import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";
import { rateLimitMiddleware } from "../lib/rate";
import { getScanMode } from "../lib/env";

function setBasicCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-Request-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}

function getRequestId(req: VercelRequest): string {
  const fromHeader =
    (req.headers["x-request-id"] as string | undefined) ??
    (req.headers["x-request-id".toLowerCase()] as string | undefined);

  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setBasicCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");

  // Rate limiting (only active if env vars are set)
  if (!rateLimitMiddleware(req, res)) {
    return;
  }

  if (req.method !== "POST") {

    res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST for /api/scan.",
      meta: { requestId },
    });
    return;
  }

  const body: any = req.body ?? {};

  const network =
    typeof body.network === "string" && body.network.trim().length > 0
      ? body.network.trim()
      : "solana-devnet";

  // Aceita tanto rawTransaction quanto txBase64 como alias
  const rawCandidate =
    typeof body.rawTransaction === "string" && body.rawTransaction.trim().length > 0
      ? body.rawTransaction.trim()
      : typeof body.txBase64 === "string" && body.txBase64.trim().length > 0
      ? body.txBase64.trim()
      : null;

  if (!rawCandidate) {
    res.status(400).json({
      success: false,
      error: "rawTransaction field is missing or invalid.",
      meta: { requestId },
    });
    return;
  }

  // Stub de resposta de risco – em produção vamos plugar o engine real
  const shieldScore = 80;
  const riskLevel = "B";
  const mode = getScanMode();

  const response = {
    network,
    shieldScore,
    riskLevel,
    rawLength: rawCandidate.length,
    badges: [
      {
        id: "liquidity_locked",
        label: "Liquidity Locked",
        level: "LOW",
        score: 92,
      },
      {
        id: "owner_renounced",
        label: "Owner Renounced",
        level: "LOW",
        score: 88,
      },
    ],
  };

  res.status(200).json({
    success: true,
    response,
    meta: { requestId, mode },
  });
}
