/**
 * Schema validation tests
 * Tests that invalid inputs return 400 with issues[]
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateLaunchpadInput,
  tokenDraftSchema,
  launchConfigDraftSchema,
} from "../schemas";

// Mock jest if not available (fallback for Node.js)
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
  toHaveLength: (length: number) => {
    if (actual.length !== length)
      throw new Error(`Expected length ${length}, got ${actual.length}`);
  },
  toContain: (item: any) => {
    if (!actual.includes(item))
      throw new Error(`Expected array to contain ${item}`);
  },
}));

describe("TokenDraft Schema Validation", () => {
  it("should reject empty name", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      symbol: "MAT",
      decimals: 9,
      name: "",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.path.includes("name"))).toBe(true);
  });

  it("should reject name longer than 32 characters", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "A".repeat(33),
      symbol: "MAT",
      decimals: 9,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("name"))).toBe(true);
  });

  it("should reject symbol longer than 10 characters", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "My Token",
      symbol: "A".repeat(11),
      decimals: 9,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("symbol"))).toBe(true);
  });

  it("should reject decimals > 18", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "My Token",
      symbol: "MAT",
      decimals: 19,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("decimals"))).toBe(true);
  });

  it("should reject decimals < 0", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "My Token",
      symbol: "MAT",
      decimals: -1,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("decimals"))).toBe(true);
  });

  it("should reject description longer than 500 characters", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "My Token",
      symbol: "MAT",
      decimals: 9,
      description: "A".repeat(501),
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("should accept valid token draft", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "My Awesome Token",
      symbol: "MAT",
      decimals: 9,
      description: "A great token",
    });
    expect(result.ok).toBe(true);
    expect(result.data.name).toBe("My Awesome Token");
  });

  it("should reject additional properties", () => {
    const result = validateLaunchpadInput(tokenDraftSchema, {
      name: "My Token",
      symbol: "MAT",
      decimals: 9,
      extraField: "not allowed",
    } as any);
    expect(result.ok).toBe(false);
  });
});

describe("LaunchConfigDraft Schema Validation", () => {
  it("should reject invalid launch wallet (too short)", () => {
    const result = validateLaunchpadInput(launchConfigDraftSchema, {
      launchWallet: "short",
      token: {
        name: "My Token",
        symbol: "MAT",
        decimals: 9,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("launchWallet"))).toBe(true);
  });

  it("should reject invalid launch wallet (invalid base58)", () => {
    const result = validateLaunchpadInput(launchConfigDraftSchema, {
      launchWallet: "0".repeat(44), // Contains 0 which is invalid in base58
      token: {
        name: "My Token",
        symbol: "MAT",
        decimals: 9,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("launchWallet"))).toBe(true);
  });

  it("should reject tipWallet without tipLamports", () => {
    const result = validateLaunchpadInput(launchConfigDraftSchema, {
      launchWallet: "So11111111111111111111111111111111111111112",
      tipWallet: "So11111111111111111111111111111111111111112",
      token: {
        name: "My Token",
        symbol: "MAT",
        decimals: 9,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("tipLamports"))).toBe(true);
  });

  it("should reject tipLamports = 0 when tipWallet provided", () => {
    const result = validateLaunchpadInput(launchConfigDraftSchema, {
      launchWallet: "So11111111111111111111111111111111111111112",
      tipWallet: "So11111111111111111111111111111111111111112",
      tipLamports: 0,
      token: {
        name: "My Token",
        symbol: "MAT",
        decimals: 9,
      },
    });
    expect(result.ok).toBe(false);
  });

  it("should accept valid launch config", () => {
    const result = validateLaunchpadInput(launchConfigDraftSchema, {
      launchWallet: "So11111111111111111111111111111111111111112",
      token: {
        name: "My Token",
        symbol: "MAT",
        decimals: 9,
      },
    });
    expect(result.ok).toBe(true);
  });

  it("should accept valid launch config with tip", () => {
    const result = validateLaunchpadInput(launchConfigDraftSchema, {
      launchWallet: "So11111111111111111111111111111111111111112",
      tipWallet: "So11111111111111111111111111111111111111112",
      tipLamports: 1000000,
      token: {
        name: "My Token",
        symbol: "MAT",
        decimals: 9,
      },
    });
    expect(result.ok).toBe(true);
  });
});
