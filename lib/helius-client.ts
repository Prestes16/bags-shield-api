// Helius API Client for Solana Mainnet data
const HELIUS_API_KEY = "1a9a5335-5b0b-444b-a24c-e477cca06a7c";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=b472996c-2166-4f29-8e41-c06251e6ee3c`;
const HELIUS_API_URL = "https://api.helius.xyz/v0";

export interface HeliusTokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  updateAuthority?: string;
  creators?: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  price?: number;
  priceChange24h?: number;
}

export interface HeliusTokenPrice {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

class HeliusClient {
  private apiKey: string;
  private rpcUrl: string;

  constructor() {
    this.apiKey = HELIUS_API_KEY;
    this.rpcUrl = HELIUS_RPC_URL;
  }

  /**
   * Get token metadata from Helius DAS API
   */
  async getTokenMetadata(mintAddress: string): Promise<HeliusTokenMetadata | null> {
    try {
      const response = await fetch(`${HELIUS_API_URL}/token-metadata?api-key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mintAccounts: [mintAddress],
        }),
      });

      if (!response.ok) {
        console.error("[v0] Helius metadata fetch failed:", response.status);
        return null;
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        return null;
      }

      const metadata = data[0];
      return {
        mint: mintAddress,
        name: metadata.onChainMetadata?.metadata?.data?.name || "Unknown Token",
        symbol: metadata.onChainMetadata?.metadata?.data?.symbol || "???",
        description: metadata.onChainMetadata?.metadata?.data?.description,
        image: metadata.onChainMetadata?.metadata?.data?.uri
          ? await this.fetchTokenImage(metadata.onChainMetadata.metadata.data.uri)
          : undefined,
        updateAuthority: metadata.updateAuthority,
        creators: metadata.onChainMetadata?.metadata?.data?.creators,
      };
    } catch (error) {
      console.error("[v0] Error fetching token metadata:", error);
      return null;
    }
  }

  /**
   * Fetch token image from metadata URI
   */
  private async fetchTokenImage(uri: string): Promise<string | undefined> {
    try {
      // Handle IPFS URLs
      if (uri.startsWith("ipfs://")) {
        uri = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
      }

      const response = await fetch(uri);
      if (!response.ok) return undefined;

      const metadata = await response.json();
      let imageUrl = metadata.image;

      // Handle IPFS image URLs
      if (imageUrl?.startsWith("ipfs://")) {
        imageUrl = imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
      }

      return imageUrl;
    } catch (error) {
      console.error("[v0] Error fetching token image:", error);
      return undefined;
    }
  }

  /**
   * Get token price from DexScreener API (public, no auth required)
   */
  async getTokenPrice(mintAddress: string): Promise<HeliusTokenPrice | null> {
    try {
      // DexScreener provides accurate prices without auth requirements
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`
      );

      if (!response.ok) {
        console.error("[v0] DexScreener price fetch failed:", response.status);
        return null;
      }

      const data = await response.json();
      
      // Get the most liquid pair (usually first in the array)
      const pair = data.pairs?.[0];

      if (!pair) {
        return null;
      }

      return {
        price: parseFloat(pair.priceUsd) || 0,
        priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
        volume24h: parseFloat(pair.volume?.h24) || 0,
        liquidity: parseFloat(pair.liquidity?.usd) || 0,
      };
    } catch (error) {
      console.error("[v0] Error fetching token price:", error);
      return null;
    }
  }

  /**
   * Get complete token info (metadata + price)
   */
  async getTokenInfo(mintAddress: string): Promise<{
    metadata: HeliusTokenMetadata | null;
    price: HeliusTokenPrice | null;
  }> {
    const [metadata, price] = await Promise.all([
      this.getTokenMetadata(mintAddress),
      this.getTokenPrice(mintAddress),
    ]);

    return { metadata, price };
  }

  /**
   * Get multiple token prices in batch
   */
  async getBatchTokenPrices(mintAddresses: string[]): Promise<Map<string, HeliusTokenPrice>> {
    const priceMap = new Map<string, HeliusTokenPrice>();

    try {
      // DexScreener batch query - fetch individually and combine
      // (DexScreener doesn't have a batch endpoint, but it's fast enough)
      const pricePromises = mintAddresses.map(async (mint) => {
        const price = await this.getTokenPrice(mint);
        return { mint, price };
      });

      const results = await Promise.all(pricePromises);

      for (const { mint, price } of results) {
        if (price) {
          priceMap.set(mint, price);
        }
      }

      console.log("[v0] Batch fetched prices for", priceMap.size, "tokens");
    } catch (error) {
      console.error("[v0] Error fetching batch prices:", error);
    }

    return priceMap;
  }

  /**
   * Get account balance for a token
   */
  async getTokenBalance(walletAddress: string, mintAddress: string): Promise<number> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            walletAddress,
            {
              mint: mintAddress,
            },
            {
              encoding: "jsonParsed",
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.result?.value?.[0]) {
        const balance = data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        return balance || 0;
      }

      return 0;
    } catch (error) {
      console.error("[v0] Error fetching token balance:", error);
      return 0;
    }
  }
}

export const heliusClient = new HeliusClient();
