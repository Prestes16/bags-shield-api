/**
 * Proxy route for /api/scan
 * Forwards requests to Bags Shield API backend
 */

import { forwardToBackend } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return forwardToBackend(req, "/api/scan");
}

export async function GET(req: Request) {
  return forwardToBackend(req, "/api/scan");
}
