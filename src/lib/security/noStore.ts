/**
 * Cache control utilities - no-store headers
 */

import type { NextResponse } from "next/server";

/**
 * Apply no-store cache headers
 */
export function applyNoStore(res: Response): Response {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
