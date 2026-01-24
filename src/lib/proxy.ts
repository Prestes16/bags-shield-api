/**
 * Generic proxy helper for forwarding requests to Bags Shield API backend
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forward a request to the Bags Shield API backend
 */
export async function forwardToBackend(
  req: Request,
  path: string
): Promise<Response> {
  const base = process.env.BAGS_SHIELD_API_BASE;
  
  if (!base) {
    return Response.json(
      {
        success: false,
        error: {
          code: "MISSING_BAGS_SHIELD_API_BASE",
          message: "BAGS_SHIELD_API_BASE environment variable is not configured",
        },
      },
      { status: 501 }
    );
  }

  // Preserve query string for GET requests
  const urlObj = new URL(req.url);
  const queryString = urlObj.search;
  const url = `${base.replace(/\/+$/, "")}${path}${queryString}`;
  
  // Get request body for non-GET/HEAD requests
  let body: string | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    try {
      body = await req.text();
    } catch (error) {
      return Response.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Failed to read request body",
          },
        },
        { status: 400 }
      );
    }
  }

  // Forward request
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        "accept": "application/json",
        // Forward X-Request-Id if present
        ...(req.headers.get("x-request-id")
          ? { "x-request-id": req.headers.get("x-request-id")! }
          : {}),
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();

    // Try to parse as JSON to preserve structure
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // If not JSON, return as-is
      return new Response(text, {
        status: response.status,
        headers: {
          "content-type": response.headers.get("content-type") ?? "text/plain",
          "cache-control": "no-store",
        },
      });
    }

    // Return JSON response
    return Response.json(json, {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        // Forward X-Request-Id from backend if present
        ...(response.headers.get("x-request-id")
          ? { "x-request-id": response.headers.get("x-request-id")! }
          : {}),
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          code: "UPSTREAM_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to connect to backend API",
        },
      },
      { status: 502 }
    );
  }
}
