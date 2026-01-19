import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_PAYLOAD_SIZE_BYTES = 10 * 1024; // 10KB

export function validatePayloadSize(req: VercelRequest, res: VercelResponse, requestId: string): boolean {
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    const contentLength = req.headers["content-length"];
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_PAYLOAD_SIZE_BYTES) {
        res.status(413).json({
          success: false,
          error: "payload_too_large",
          message: `Request payload exceeds the maximum allowed size of ${MAX_PAYLOAD_SIZE_BYTES / 1024}KB.`,
          meta: { requestId },
        });
        return false;
      }
    }
  }
  return true;
}
