/**
 * Internal typed client for Bags Shield API.
 * Prevents API contract drift between frontend and backend.
 */

export type Envelope<T> =
  | { success: true; response: T; error?: never; meta: { requestId: string; [key: string]: unknown } }
  | { success: false; response?: never; error: string | { code: string; message: string; details?: unknown }; meta: { requestId: string; [key: string]: unknown } };

export interface ClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

async function postJSON<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<Envelope<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Envelope<T>;
}

// Response types

export interface ScanResponse {
  network: string;
  shieldScore: number;
  riskLevel: string;
  rawLength: number;
  badges: Array<{
    id: string;
    label: string;
    level: string;
    score: number;
  }>;
}

export interface ScanRequest {
  rawTransaction?: string;
  txBase64?: string; // alias for rawTransaction
  network?: string;
}

export interface SimulateResponse {
  isSafe: boolean;
  shieldScore: number;
  grade: string;
  warnings: unknown[];
  metadata: {
    mode: string;
    mintLength: number;
    base: string | null;
  };
}

export interface SimulateRequest {
  mint: string;
}

export interface ApplyResponse {
  applied: boolean;
}

export interface ApplyRequest {
  action?: string;
  mint?: string;
  [key: string]: unknown;
}

// Client functions

export class BagsShieldClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.headers = options.headers || {};
  }

  /**
   * Scan a raw Solana transaction for security risks.
   */
  async scan(request: ScanRequest): Promise<Envelope<ScanResponse>> {
    return postJSON<ScanResponse>(
      `${this.baseUrl}/api/scan`,
      request,
      this.headers
    );
  }

  /**
   * Simulate the effects of a transaction.
   */
  async simulate(request: SimulateRequest): Promise<Envelope<SimulateResponse>> {
    return postJSON<SimulateResponse>(
      `${this.baseUrl}/api/simulate`,
      request,
      this.headers
    );
  }

  /**
   * Apply decision rules based on scan/simulation results.
   */
  async apply(request: ApplyRequest): Promise<Envelope<ApplyResponse>> {
    return postJSON<ApplyResponse>(
      `${this.baseUrl}/api/apply`,
      request,
      this.headers
    );
  }
}

// Convenience functions (functional API)

export function createClient(options: ClientOptions): BagsShieldClient {
  return new BagsShieldClient(options);
}

export async function scan(
  baseUrl: string,
  request: ScanRequest,
  headers?: Record<string, string>
): Promise<Envelope<ScanResponse>> {
  return postJSON<ScanResponse>(
    `${baseUrl.replace(/\/+$/, "")}/api/scan`,
    request,
    headers
  );
}

export async function simulate(
  baseUrl: string,
  request: SimulateRequest,
  headers?: Record<string, string>
): Promise<Envelope<SimulateResponse>> {
  return postJSON<SimulateResponse>(
    `${baseUrl.replace(/\/+$/, "")}/api/simulate`,
    request,
    headers
  );
}

export async function apply(
  baseUrl: string,
  request: ApplyRequest,
  headers?: Record<string, string>
): Promise<Envelope<ApplyResponse>> {
  return postJSON<ApplyResponse>(
    `${baseUrl.replace(/\/+$/, "")}/api/apply`,
    request,
    headers
  );
}
