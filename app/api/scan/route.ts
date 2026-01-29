import { NextRequest, NextResponse } from "next/server";

// Mock scan data - Replace with real backend integration
const mockScanResults: Record<string, any> = {
  // Example safe token (BONK)
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {
    tokenInfo: {
      name: "Bonk",
      symbol: "BONK",
      imageUrl: "/images/bags-token-icon.jpg",
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      supply: 100000000000,
    },
    security: {
      score: 88,
      grade: "A",
      isSafe: true,
      mintAuthority: false,
      freezeAuthority: false,
      lpLocked: true,
    },
    integrity: {
      isVerified: true,
    },
    findings: [
      {
        severity: "LOW",
        label: "Verified Token",
        description: "Token is verified on major platforms",
      },
      {
        severity: "LOW",
        label: "High Liquidity",
        description: "Token has sufficient liquidity depth",
      },
    ],
    meta: {
      fromCache: false,
      stale: false,
      source: "live",
      dataSources: ["on-chain", "social"],
      timestamp: Date.now(),
    },
  },
  // Example warning token
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: {
    tokenInfo: {
      name: "dogwifhat",
      symbol: "WIF",
      imageUrl: "/images/bags-token-icon.jpg",
      mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
      supply: 998926393,
    },
    security: {
      score: 65,
      grade: "C",
      isSafe: false,
      mintAuthority: true,
      freezeAuthority: false,
      lpLocked: false,
    },
    integrity: {
      isVerified: false,
    },
    findings: [
      {
        severity: "MEDIUM",
        label: "Concentrated Holdings",
        description: "Top 10 wallets hold more than 50% of supply",
      },
      {
        severity: "HIGH",
        label: "Mint Authority Active",
        description: "Token has active mint authority - supply can be inflated",
      },
      {
        severity: "LOW",
        label: "Recent Token",
        description: "Token was created less than 30 days ago",
      },
    ],
    meta: {
      fromCache: true,
      stale: false,
      source: "cache",
      dataSources: ["cache", "on-chain"],
      timestamp: Date.now() - 3600000,
    },
  },
};

// Rate limiting map (per IP, simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // requests per window

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  limit.count++;
  return true;
}

// Pro Scan payment validation (mock)
const PRO_SCAN_PRICE_LAMPORTS = 500000000; // 0.5 SOL
const OPS_WALLET = "BatchmoonMoonbatchMoonBatchMoonbatch11111111";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { mint, pro = false, proSignature = null } = body;

    if (!mint || typeof mint !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid mint address in request body" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pro Scan validation
    if (pro && !proSignature) {
      return NextResponse.json(
        {
          error: "Pro Scan requires payment",
          code: "PAYMENT_REQUIRED",
          requiredLamports: PRO_SCAN_PRICE_LAMPORTS,
          destination: OPS_WALLET,
        },
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Simulate Pro Scan processing
    if (pro) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Check if we have mock data for this mint
    let mockData = mockScanResults[mint];

    if (mockData) {
      // Return with fresh metadata if pro scan
      if (pro) {
        mockData = {
          ...mockData,
          meta: {
            fromCache: false,
            stale: false,
            source: "live",
            dataSources: ["on-chain", "social", "pro-analysis"],
            timestamp: Date.now(),
          },
        };
      }
      return NextResponse.json(mockData, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      });
    }

    // For unknown mints, generate a random result
    const randomScore = Math.floor(Math.random() * 60) + 30; // 30-90
    const grade =
      randomScore >= 80 ? "A" : randomScore >= 60 ? "B" : randomScore >= 40 ? "C" : "D";
    const isSafe = randomScore >= 70;

    return NextResponse.json(
      {
        tokenInfo: {
          name: "Unknown Token",
          symbol: mint.slice(0, 4).toUpperCase(),
          imageUrl: null,
          mint,
          supply: 0,
        },
        security: {
          score: randomScore,
          grade,
          isSafe,
          mintAuthority: !isSafe,
          freezeAuthority: false,
          lpLocked: isSafe,
        },
        integrity: {
          isVerified: false,
        },
        findings: [
          {
            severity: isSafe ? "LOW" : "HIGH",
            label: pro ? "Pro Scan Analysis" : "Unverified Token",
            description: pro
              ? "Detailed analysis completed with premium features"
              : "This token has not been verified on major platforms",
          },
          {
            severity: "LOW",
            label: "Limited Data",
            description: "Limited historical data available for this token",
          },
        ],
        meta: {
          fromCache: false,
          stale: false,
          source: pro ? "pro-scan" : "live",
          dataSources: pro ? ["pro-analysis"] : ["on-chain"],
          timestamp: Date.now(),
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[v0] /api/scan error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const mint = searchParams.get("mint");
    const pro = searchParams.get("pro") === "true";

    if (!mint || typeof mint !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid mint address parameter" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Simulate scan delay
    await new Promise((resolve) => setTimeout(resolve, pro ? 1500 : 800));

    // Check if we have mock data for this mint
    let mockData = mockScanResults[mint];

    if (mockData) {
      if (pro) {
        mockData = {
          ...mockData,
          meta: {
            fromCache: false,
            stale: false,
            source: "live",
            dataSources: ["on-chain", "social", "pro-analysis"],
            timestamp: Date.now(),
          },
        };
      }
      return NextResponse.json(mockData, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      });
    }

    // For unknown mints, generate a random result
    const randomScore = Math.floor(Math.random() * 60) + 30;
    const grade =
      randomScore >= 80 ? "A" : randomScore >= 60 ? "B" : randomScore >= 40 ? "C" : "D";
    const isSafe = randomScore >= 70;

    return NextResponse.json(
      {
        tokenInfo: {
          name: "Unknown Token",
          symbol: mint.slice(0, 4).toUpperCase(),
          imageUrl: null,
          mint,
          supply: 0,
        },
        security: {
          score: randomScore,
          grade,
          isSafe,
          mintAuthority: !isSafe,
          freezeAuthority: false,
          lpLocked: isSafe,
        },
        integrity: {
          isVerified: false,
        },
        findings: [
          {
            severity: isSafe ? "LOW" : "MEDIUM",
            label: "Unverified Token",
            description: "This token has not been verified on major platforms",
          },
          {
            severity: "LOW",
            label: "Limited Data",
            description: "Limited historical data available for this token",
          },
        ],
        meta: {
          fromCache: false,
          stale: false,
          source: "live",
          dataSources: ["on-chain"],
          timestamp: Date.now(),
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[v0] /api/scan GET error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  }
}
