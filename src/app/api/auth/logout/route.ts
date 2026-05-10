import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": process.env.FRONTEND_URL || "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

export async function POST() {
  // JWT is stateless — client-side just deletes the token.
  // This endpoint exists for completeness / audit / future token blacklist.
  return NextResponse.json(
    { success: true, message: "Logged out" },
    { headers: CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
