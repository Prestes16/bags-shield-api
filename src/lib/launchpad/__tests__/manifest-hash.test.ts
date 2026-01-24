/**
 * Manifest hash determinism tests
 * Tests that same normalized payload produces same hash
 */

import { createHash } from "crypto";

// Mock jest if not available
const describe = describe || ((name: string, fn: () => void) => fn());
const it = it || ((name: string, fn: () => void) => fn());
const expect = expect || ((actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
  },
  toEqual: (expected: any) => {
    if (actual !== expected)
      throw new Error(`Expected ${expected}, got ${actual}`);
  },
}));

/**
 * Normalize payload for hashing (same logic as manifest route)
 */
function normalizePayload(payload: any): string {
  const normalized = {
    mint: payload.mint,
    shieldScore: payload.shieldScore,
    grade: payload.grade,
    isSafe: payload.isSafe,
    badges: payload.badges
      .map((b: any) => ({
        key: b.key,
        title: b.title,
        severity: b.severity,
        impact: b.impact,
        tags: [...b.tags].sort(),
      }))
      .sort((a: any, b: any) => a.key.localeCompare(b.key)),
    summary: payload.summary,
  };
  return JSON.stringify(normalized);
}

/**
 * Generate hash of payload
 */
function generateHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

describe("Manifest Hash Determinism", () => {
  const basePayload = {
    mint: "So11111111111111111111111111111111111111112",
    shieldScore: 85,
    grade: "A" as const,
    isSafe: true,
    badges: [
      {
        key: "validated",
        title: "Token Validated",
        severity: "low" as const,
        impact: "positive" as const,
        tags: ["validation", "security"],
      },
    ],
    summary: "Token passed all security validations",
  };

  it("should produce same hash for identical payloads", () => {
    const payload1 = normalizePayload(basePayload);
    const payload2 = normalizePayload(basePayload);
    const hash1 = generateHash(payload1);
    const hash2 = generateHash(payload2);

    expect(hash1).toBe(hash2);
  });

  it("should produce same hash regardless of badge order", () => {
    const payload1 = {
      ...basePayload,
      badges: [
        {
          key: "validated",
          title: "Token Validated",
          severity: "low" as const,
          impact: "positive" as const,
          tags: ["validation", "security"],
        },
        {
          key: "secure",
          title: "Secure Token",
          severity: "low" as const,
          impact: "positive" as const,
          tags: ["security"],
        },
      ],
    };

    const payload2 = {
      ...basePayload,
      badges: [
        {
          key: "secure",
          title: "Secure Token",
          severity: "low" as const,
          impact: "positive" as const,
          tags: ["security"],
        },
        {
          key: "validated",
          title: "Token Validated",
          severity: "low" as const,
          impact: "positive" as const,
          tags: ["validation", "security"],
        },
      ],
    };

    const hash1 = generateHash(normalizePayload(payload1));
    const hash2 = generateHash(normalizePayload(payload2));

    expect(hash1).toBe(hash2);
  });

  it("should produce same hash regardless of tag order within badges", () => {
    const payload1 = {
      ...basePayload,
      badges: [
        {
          key: "validated",
          title: "Token Validated",
          severity: "low" as const,
          impact: "positive" as const,
          tags: ["validation", "security"],
        },
      ],
    };

    const payload2 = {
      ...basePayload,
      badges: [
        {
          key: "validated",
          title: "Token Validated",
          severity: "low" as const,
          impact: "positive" as const,
          tags: ["security", "validation"], // Different order
        },
      ],
    };

    const hash1 = generateHash(normalizePayload(payload1));
    const hash2 = generateHash(normalizePayload(payload2));

    expect(hash1).toBe(hash2);
  });

  it("should produce different hash for different payloads", () => {
    const payload1 = normalizePayload(basePayload);
    const payload2 = normalizePayload({
      ...basePayload,
      shieldScore: 90, // Different score
    });

    const hash1 = generateHash(payload1);
    const hash2 = generateHash(payload2);

    expect(hash1).not.toBe(hash2);
  });

  it("should ignore extra fields not in normalized structure", () => {
    const payload1 = normalizePayload(basePayload);
    const payload2 = normalizePayload({
      ...basePayload,
      extraField: "ignored", // Should be ignored
      evaluatedAt: "2024-01-01T00:00:00Z", // Should be ignored
      requestId: "test-id", // Should be ignored
    });

    const hash1 = generateHash(payload1);
    const hash2 = generateHash(payload2);

    expect(hash1).toBe(hash2);
  });
});
