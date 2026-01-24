#!/usr/bin/env node
/**
 * Manifest hash determinism tests
 * Tests that same normalized payload produces same hash
 */

const { createHash } = require("crypto");

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

/**
 * Normalize payload for hashing (same logic as manifest route)
 */
function normalizePayload(payload) {
  const normalized = {
    mint: payload.mint,
    shieldScore: payload.shieldScore,
    grade: payload.grade,
    isSafe: payload.isSafe,
    badges: payload.badges
      .map((b) => ({
        key: b.key,
        title: b.title,
        severity: b.severity,
        impact: b.impact,
        tags: [...b.tags].sort(),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    summary: payload.summary,
  };
  return JSON.stringify(normalized);
}

/**
 * Generate hash of payload
 */
function generateHash(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

const basePayload = {
  mint: "So11111111111111111111111111111111111111112",
  shieldScore: 85,
  grade: "A",
  isSafe: true,
  badges: [
    {
      key: "validated",
      title: "Token Validated",
      severity: "low",
      impact: "positive",
      tags: ["validation", "security"],
    },
  ],
  summary: "Token passed all security validations",
};

console.log("Running Manifest Hash Determinism Tests...\n");

test("should produce same hash for identical payloads", () => {
  const payload1 = normalizePayload(basePayload);
  const payload2 = normalizePayload(basePayload);
  const hash1 = generateHash(payload1);
  const hash2 = generateHash(payload2);

  assert(hash1 === hash2, "Hashes should be identical");
});

test("should produce same hash regardless of badge order", () => {
  const payload1 = {
    ...basePayload,
    badges: [
      { key: "validated", title: "Token Validated", severity: "low", impact: "positive", tags: ["validation", "security"] },
      { key: "secure", title: "Secure Token", severity: "low", impact: "positive", tags: ["security"] },
    ],
  };

  const payload2 = {
    ...basePayload,
    badges: [
      { key: "secure", title: "Secure Token", severity: "low", impact: "positive", tags: ["security"] },
      { key: "validated", title: "Token Validated", severity: "low", impact: "positive", tags: ["validation", "security"] },
    ],
  };

  const hash1 = generateHash(normalizePayload(payload1));
  const hash2 = generateHash(normalizePayload(payload2));

  assert(hash1 === hash2, "Hashes should be same regardless of badge order");
});

test("should produce same hash regardless of tag order", () => {
  const payload1 = {
    ...basePayload,
    badges: [
      { key: "validated", title: "Token Validated", severity: "low", impact: "positive", tags: ["validation", "security"] },
    ],
  };

  const payload2 = {
    ...basePayload,
    badges: [
      { key: "validated", title: "Token Validated", severity: "low", impact: "positive", tags: ["security", "validation"] },
    ],
  };

  const hash1 = generateHash(normalizePayload(payload1));
  const hash2 = generateHash(normalizePayload(payload2));

  assert(hash1 === hash2, "Hashes should be same regardless of tag order");
});

test("should produce different hash for different payloads", () => {
  const payload1 = normalizePayload(basePayload);
  const payload2 = normalizePayload({
    ...basePayload,
    shieldScore: 90,
  });

  const hash1 = generateHash(payload1);
  const hash2 = generateHash(payload2);

  assert(hash1 !== hash2, "Hashes should be different for different payloads");
});

test("should ignore extra fields not in normalized structure", () => {
  const payload1 = normalizePayload(basePayload);
  const payload2 = normalizePayload({
    ...basePayload,
    extraField: "ignored",
    evaluatedAt: "2024-01-01T00:00:00Z",
    requestId: "test-id",
  });

  const hash1 = generateHash(payload1);
  const hash2 = generateHash(payload2);

  assert(hash1 === hash2, "Hashes should be same (extra fields ignored)");
});

console.log(`\nTests: ${testsRun} | Passed: ${testsPassed} | Failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
