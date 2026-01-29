/**
 * Backend Client - Centralized API communication layer
 * All backend calls should go through this client to maintain consistency
 */

export interface ScanResult {
  tokenInfo: {
    name: string;
    symbol: string;
    imageUrl?: string;
    mint: string;
    supply?: number;
  };
  security: {
    score: number;
    grade: "A" | "B" | "C" | "D" | "E";
    isSafe: boolean;
    mintAuthority: boolean;
    freezeAuthority: boolean;
    lpLocked: boolean;
  };
  integrity: {
    isVerified: boolean;
  };
  findings: Array<{
    severity: "HIGH" | "MEDIUM" | "LOW";
    label: string;
    description: string;
  }>;
  meta?: {
    fromCache?: boolean;
    stale?: boolean;
    source?: "live" | "cache" | "pro-scan";
    dataSources?: string[];
    timestamp?: number;
  };
  // Legacy fields for backwards compatibility
  mint?: string;
  name?: string;
  symbol?: string;
  logoUrl?: string;
  score?: number;
  grade?: string;
  status?: "safe" | "warning" | "danger";
}

export interface SimulationResult {
  status: "approved" | "warning" | "failed";
  riskLevel: "low" | "medium" | "high" | "critical";
  input: { amount: number; token: string };
  output: { amount: number; token: string };
  priceImpact: number;
  networkFee: number;
  securityChecks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail?: string;
  }>;
  errorMessage?: string;
}

export interface WalletBalance {
  sol: number;
  usd: number;
  tokens: Array<{
    mint: string;
    symbol: string;
    balance: number;
    usdValue: number;
  }>;
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

class BackendClient {
  private baseUrl = "/api";

  private async handleResponse(response: Response, endpoint: string) {
    if (!response.ok) {
      // Check for specific error codes in response
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText, code: "UNKNOWN_ERROR" };
      }

      const message = errorData.error || response.statusText;
      const code = errorData.code || `HTTP_${response.status}`;

      throw new APIError(message, response.status, code);
    }

    // Validate content type
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new APIError(
        "Backend returned non-JSON response",
        response.status,
        "INVALID_RESPONSE",
      );
    }

    try {
      return await response.json();
    } catch {
      throw new APIError(
        "Failed to parse JSON response",
        response.status,
        "JSON_PARSE_ERROR",
      );
    }
  }

  /**
   * Scan a token by mint address
   */
  async scan(mint: string): Promise<ScanResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint }),
      });

      return await this.handleResponse(response, "scan");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Simulate a transaction
   */
  async simulate(payload: {
    fromToken: string;
    toToken: string;
    amount: number;
  }): Promise<SimulationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return await this.handleResponse(response, "simulate");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Apply/execute a transaction
   */
  async apply(payload: {
    transactionData: string;
    signature?: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return await this.handleResponse(response, "apply");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(address: string): Promise<WalletBalance> {
    try {
      const response = await fetch(
        `${this.baseUrl}/wallet/balance?address=${encodeURIComponent(address)}`,
      );

      return await this.handleResponse(response, "wallet/balance");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Get scan history
   */
  async getScanHistory(
    limit = 20,
    offset = 0,
  ): Promise<{ items: ScanResult[]; total: number }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/history?limit=${limit}&offset=${offset}`,
      );

      return await this.handleResponse(response, "history");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Get watchlist
   */
  async getWatchlist(): Promise<ScanResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/watchlist`);

      return await this.handleResponse(response, "watchlist");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(mint: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint }),
      });

      await this.handleResponse(response, "watchlist");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(mint: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/watchlist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint }),
      });

      await this.handleResponse(response, "watchlist");
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : "Unknown error",
        0,
        "NETWORK_ERROR",
      );
    }
  }
}

// Export singleton instance
export const backendClient = new BackendClient();
