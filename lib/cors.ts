import type { VercelRequest, VercelResponse } from "@vercel/node";

export function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}

export function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
}

export function ensureRequestId(res: VercelResponse): string {
  const existing = (res as any).getHeader?.("X-Request-Id") as string | undefined;
  const id =
    existing ??
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  res.setHeader("X-Request-Id", id);
  return id;
}

export function preflight(
  res: VercelResponse,
  methods: string[],
  headers: string[] = ["Content-Type", "Authorization", "x-api-key"]
) {
  setCors(res);
  noStore(res);
  ensureRequestId(res);
  res.setHeader("Access-Control-Allow-Methods", methods.join(","));
  res.setHeader("Access-Control-Allow-Headers", headers.join(","));
  res.status(204).end();
}

export function guardMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowed: string[]
): boolean {
  const method = req.method ?? "";
  if (!allowed.includes(method)) {
    setCors(res);
    noStore(res);
    const requestId = ensureRequestId(res);
    res.setHeader("Allow", allowed.join(","));
    res
      .status(405)
      .json({ success: false, error: "method_not_allowed", meta: { requestId } });
    return false;
  }
  return true;
}