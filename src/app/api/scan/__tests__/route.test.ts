/**
 * Unit tests for hardened /api/scan endpoint
 * Tests strict validation, anti-forgery, and abuse controls
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock external dependencies
jest.mock("@/lib/security", () => ({
  applyCorsHeaders: jest.fn(),
  applyNoStore: jest.fn(), 
  applySecurityHeaders: jest.fn(),
  getOrGenerateRequestId: jest.fn(() => "test-req-123"),
  SafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

jest.mock("@/lib/security/validate", () => ({
  LaunchpadValidator: {
    validateMint: jest.fn().mockImplementation(function(mint) {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
    }),
    validateWallet: jest.fn().mockImplementation(function(wallet) {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
    })
  }
}));

jest.mock("@/lib/security/jsonParseSafe", () => ({
  safeJsonParse: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();
global.crypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: jest.fn().mockResolvedValue({}),
    sign: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  }
} as any;

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const { safeJsonParse } = require("@/lib/security/jsonParseSafe");

describe("/api/scan hardened endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    process.env.SCAN_HMAC_SECRET = "test-secret-key-for-hmac-signing";
  });

  afterEach(() => {
    delete process.env.SCAN_HMAC_SECRET;
  });

  describe("Request Validation", () => {
    test("should reject invalid mint address", async () => {
      const req = new NextRequest("http://localhost/api/scan?mint=invalid", {
        method: "GET"
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.issues).toContainEqual(
        expect.objectContaining({
          path: "mint",
          message: expect.stringContaining("invalid mint address")
        })
      );
    });

    test("should reject mint that's too short", async () => {
      const req = new NextRequest("http://localhost/api/scan?mint=short", {
        method: "GET"  
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.issues).toContainEqual(
        expect.objectContaining({
          path: "mint",
          message: "mint must be at least 32 characters"
        })
      );
    });

    test("should reject request with unknown keys (strict mode)", async () => {
      safeJsonParse.mockResolvedValueOnce({
        success: true,
        data: {
          mint: "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1",
          unknownField: "should be rejected",
          anotherBadField: 123
        }
      });

      const req = new NextRequest("http://localhost/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mint: "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1",
          unknownField: "should be rejected"
        })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    test("should enforce Content-Type for POST requests", async () => {
      const req = new NextRequest("http://localhost/api/scan", {
        method: "POST",
        headers: {
          "content-type": "text/plain"
        },
        body: '{"mint": "valid"}'
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("INVALID_CONTENT_TYPE");
    });

    test("should accept valid mint in GET request", async () => {
      const validMint = "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          success: true,
          shieldScore: 85,
          grade: "A",
          summary: "Low risk token"
        })),
        headers: new Headers()
      } as any);

      const req = new NextRequest(`http://localhost/api/scan?mint=${validMint}`, {
        method: "GET"
      });

      const response = await GET(req);
      
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/scan"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ mint: validMint })
        })
      );
    });
  });

  describe("Anti-Forgery", () => {
    test("should remove client-provided integrity fields", async () => {
      const validMint = "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1";
      
      safeJsonParse.mockResolvedValueOnce({
        success: true,
        data: {
          mint: validMint,
          integrity: { fake: "signature" }, // Should be removed
          signature: "fake-sig", // Should be removed
          payloadHash: "fake-hash" // Should be removed
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          success: true,
          shieldScore: 75,
          grade: "B"
        })),
        headers: new Headers()
      } as any);

      const req = new NextRequest("http://localhost/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      });

      const response = await POST(req);
      
      // Check that cleaned data was sent upstream (no integrity fields)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ mint: validMint }) // Clean, no integrity fields
        })
      );
    });

    test("should add integrity signature to response", async () => {
      const validMint = "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          success: true,
          shieldScore: 85,
          grade: "A",
          summary: "Low risk"
        })),
        headers: new Headers()
      } as any);

      const req = new NextRequest(`http://localhost/api/scan?mint=${validMint}`, {
        method: "GET"
      });

      const response = await GET(req);
      const data = await response.json();

      expect(data.integrity).toBeDefined();
      expect(data.integrity.payloadHash).toBeDefined();
      expect(data.integrity.signature).toBeDefined();
      expect(data.integrity.evaluatedAt).toBeDefined();
      expect(data.integrity.requestId).toBe("test-req-123");
    });
  });

  describe("Rate Limiting", () => {
    test("should apply rate limiting", async () => {
      const validMint = "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1";
      
      // Mock successful upstream response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ success: true, shieldScore: 85 })),
        headers: new Headers()
      } as any);

      const createRequest = () => new NextRequest(`http://localhost/api/scan?mint=${validMint}`, {
        method: "GET",
        headers: {
          "x-forwarded-for": "1.2.3.4"
        }
      });

      // First 20 requests should pass
      for (let i = 0; i < 20; i++) {
        const response = await GET(createRequest());
        expect(response.status).toBe(200);
      }

      // 21st request should be rate limited
      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(response.headers.get("retry-after")).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle upstream timeout", async () => {
      const validMint = "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1";
      
      // Mock timeout
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          const error = new Error("Timeout");
          error.name = "AbortError";
          reject(error);
        });
      });

      const req = new NextRequest(`http://localhost/api/scan?mint=${validMint}`, {
        method: "GET"
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error.code).toBe("UPSTREAM_TIMEOUT");
    });

    test("should handle invalid JSON from upstream", async () => {
      const validMint = "8xF2A9B3C7E8D1F6H5G4J3K2L1M9N8P7Q6R5S4T3U2V1";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("invalid json response"),
        headers: new Headers()
      } as any);

      const req = new NextRequest(`http://localhost/api/scan?mint=${validMint}`, {
        method: "GET"
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error.code).toBe("UPSTREAM_INVALID_JSON");
    });
  });
});