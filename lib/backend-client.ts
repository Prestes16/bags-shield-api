/**
 * Backend Client - Centralized API communication layer
 * All backend calls should go through this client to maintain consistency
 */

export interface ScanResult {
  mint: string;
  name: string;
  symbol: string;
  logoUrl?: string;
  score: number;
  grade: string;
  status: "safe" | "warning" | "danger";
  scannedAt: string;
  findings: Array<{
    id: string;
    category: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    title: string;
    description: string;
  }>;
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

class BackendClient {
  private baseUrl = "/api";

  /**
   * Scan a token by mint address
   */
  async scan(mint: string): Promise<ScanResult> {
    const response = await fetch(`${this.baseUrl}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint }),
    });

    if (!response.ok) {
      throw new Error(`Scan failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Simulate a transaction
   */
  async simulate(payload: {
    fromToken: string;
    toToken: string;
    amount: number;
  }): Promise<SimulationResult> {
    const response = await fetch(`${this.baseUrl}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Apply/execute a transaction
   */
  async apply(payload: {
    transactionData: string;
    signature?: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const response = await fetch(`${this.baseUrl}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Apply failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(address: string): Promise<WalletBalance> {
    const response = await fetch(
      `${this.baseUrl}/wallet/balance?address=${encodeURIComponent(address)}`
    );

    if (!response.ok) {
      throw new Error(`Balance fetch failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get scan history
   */
  async getScanHistory(
    limit = 20,
    offset = 0
  ): Promise<{ items: ScanResult[]; total: number }> {
    const response = await fetch(
      `${this.baseUrl}/history?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error(`History fetch failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get watchlist
   */
  async getWatchlist(): Promise<ScanResult[]> {
    const response = await fetch(`${this.baseUrl}/watchlist`);

    if (!response.ok) {
      throw new Error(`Watchlist fetch failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(mint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint }),
    });

    if (!response.ok) {
      throw new Error(`Add to watchlist failed: ${response.statusText}`);
    }
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(mint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/watchlist`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint }),
    });

    if (!response.ok) {
      throw new Error(`Remove from watchlist failed: ${response.statusText}`);
    }
  }
}

// Export singleton instance
export const backendClient = new BackendClient();
