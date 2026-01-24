/**
 * Anti-SSRF tests
 * Tests that localhost, private IPs, and file:// URLs are blocked
 */

import { describe, it, expect } from "@jest/globals";
import { validateLaunchpadInput, tokenDraftSchema } from "../schemas";

// Mock jest if not available
const describe = describe || ((name: string, fn: () => void) => fn());
const it = it || ((name: string, fn: () => void) => fn());
const expect = expect || ((actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
  },
  toEqual: (expected: any) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  },
  toContain: (item: any) => {
    if (!actual.includes(item))
      throw new Error(`Expected array to contain ${item}`);
  },
}));

describe("Anti-SSRF URL Validation", () => {
  const validTokenBase = {
    name: "My Token",
    symbol: "MAT",
    decimals: 9,
  };

  it("should reject localhost URLs", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://localhost:8080/image.png",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should reject 127.0.0.1 URLs", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://127.0.0.1:8080/image.png",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should reject 169.254.169.254 (AWS metadata)", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://169.254.169.254/latest/meta-data/",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should reject file:// URLs", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "file:///etc/passwd",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should reject private IP ranges (10.x.x.x)", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://10.0.0.1/image.png",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should reject private IP ranges (172.16-31.x.x)", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://172.16.0.1/image.png",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should reject private IP ranges (192.168.x.x)", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://192.168.1.1/image.png",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should accept valid public HTTPS URLs", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "https://example.com/image.png",
    });
    expect(result.ok).toBe(true);
  });

  it("should accept valid public HTTP URLs", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "http://example.com/image.png",
    });
    expect(result.ok).toBe(true);
  });

  it("should reject non-HTTP/HTTPS protocols", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      imageUrl: "ftp://example.com/image.png",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("imageUrl"))).toBe(true);
  });

  it("should apply same validation to websiteUrl", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      ...validTokenBase,
      websiteUrl: "http://localhost:3000",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("websiteUrl"))).toBe(true);
  });
});
