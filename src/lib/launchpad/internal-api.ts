/**
 * Internal API client for calling /api/scan and /api/simulate internally
 */

const API_BASE =
  process.env.BAGS_SHIELD_API_BASE?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE?.trim() ||
  "http://localhost:3000";

export interface ScanResponse {
  success: boolean;
  response?: {
    shieldScore: number;
    grade: string;
    badges?: Array<{
      key: string;
      title: string;
      severity: string;
      impact: string;
      tags: string[];
    }>;
  };
  error?: string | { code: string; message: string };
  meta?: { requestId: string };
}

export interface SimulateResponse {
  success: boolean;
  response?: {
    isSafe: boolean;
    shieldScore: number;
    grade: string;
    warnings?: string[];
  };
  error?: string | { code: string; message: string };
  meta?: { requestId: string };
}

/**
 * Call /api/scan internally
 */
export async function callInternalScan(
  mint: string,
  requestId: string
): Promise<ScanResponse> {
  try {
    const url = `${API_BASE}/api/scan`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({ mint }),
    });

    const text = await response.text();
    let data: ScanResponse;

    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: "Failed to parse scan response",
        meta: { requestId },
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to call scan endpoint",
      meta: { requestId },
    };
  }
}

/**
 * Call /api/simulate internally
 */
export async function callInternalSimulate(
  mint: string,
  requestId: string
): Promise<SimulateResponse> {
  try {
    const url = `${API_BASE}/api/simulate`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({ mint }),
    });

    const text = await response.text();
    let data: SimulateResponse;

    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: "Failed to parse simulate response",
        meta: { requestId },
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to call simulate endpoint",
      meta: { requestId },
    };
  }
}
