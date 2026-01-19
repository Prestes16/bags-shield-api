import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from "../../lib/cors.js";
import { validatePayloadSize } from "../../lib/payload-validation.js";

interface ImageRequest {
  prompt: string;
  style?: string;
  size?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = ensureRequestId(res);
  
  try {
    setCors(res, req);
    if (req.method === "OPTIONS") {
      return preflight(res, ["POST"], ["Content-Type", "Authorization", "x-api-key"], req);
    }
    if (!guardMethod(req, res, ["POST"])) return;

    noStore(res);

    if (!validatePayloadSize(req, res, requestId)) {
      return;
    }

    // Parse body
    let body: ImageRequest = { prompt: "" };
    try {
      if (typeof req.body === "string") {
        body = JSON.parse(req.body);
      } else if (req.body) {
        body = req.body as ImageRequest;
      }
    } catch (e) {
      res.status(400).json({
        success: false,
        error: "invalid json",
        meta: { requestId }
      });
      return;
    }

    if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: "prompt is required",
        meta: { requestId }
      });
      return;
    }

    const provider = process.env.AI_PROVIDER || "stub";
    const apiKey = process.env.AI_API_KEY;

    // Stub mode: return placeholder
    if (provider === "stub" || !apiKey) {
      res.status(200).json({
        success: true,
        response: {
          imageUrl: "https://via.placeholder.com/800x400/020617/7af0d6?text=Bags+Shield+AI+Image",
          imageBase64: null,
          provider: "stub",
          prompt: body.prompt,
          style: body.style || "default",
          size: body.size || "800x400"
        },
        meta: { requestId, mode: "stub" }
      });
      return;
    }

    // TODO: Implement real AI providers (Gemini, OpenAI, etc.)
    // For now, return 501 if configured but not implemented
    res.status(501).json({
      success: false,
      error: "ai_provider_not_implemented",
      message: `Provider "${provider}" is configured but not yet implemented`,
      meta: { requestId }
    });
    return;
  } catch (e: any) {
    console.error("[ai/image] Error:", e);
    const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
    res.status(500).json({
      success: false,
      error: "ai_image_failed",
      message: isDev ? (e?.message || String(e)) : "internal server error",
      meta: { requestId }
    });
    return;
  }
}
