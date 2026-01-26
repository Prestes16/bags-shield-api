import { NextRequest, NextResponse } from "next/server";

// Mock scan data - Replace with real backend integration
const mockScanResults: Record<string, any> = {
  // Example safe token (BONK)
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {
    name: "Bonk",
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    logoUrl: "/images/bags-token-icon.jpg",
    score: 88,
    grade: "A",
    status: "safe",
    findings: [
      {
        id: "1",
        title: "Verified Token",
        description: "Token is verified on major platforms",
        severity: "info",
      },
      {
        id: "2",
        title: "High Liquidity",
        description: "Token has sufficient liquidity depth",
        severity: "info",
      },
    ],
  },
  // Example warning token
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: {
    name: "dogwifhat",
    symbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    logoUrl: "/images/bags-token-icon.jpg",
    score: 65,
    grade: "C",
    status: "warning",
    findings: [
      {
        id: "1",
        title: "Concentrated Holdings",
        description: "Top 10 wallets hold more than 50% of supply",
        severity: "medium",
      },
      {
        id: "2",
        title: "Recent Token",
        description: "Token was created less than 30 days ago",
        severity: "low",
      },
    ],
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");

  if (!mint) {
    return NextResponse.json(
      { error: "Missing mint address parameter" },
      { status: 400 }
    );
  }

  // Check if we have mock data for this mint
  const mockData = mockScanResults[mint];

  if (mockData) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json(mockData);
  }

  // For unknown mints, generate a random result
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const randomScore = Math.floor(Math.random() * 60) + 30; // 30-90
  const grade =
    randomScore >= 80 ? "A" : randomScore >= 60 ? "B" : randomScore >= 40 ? "C" : "D";
  const status =
    randomScore >= 70 ? "safe" : randomScore >= 50 ? "warning" : "danger";

  return NextResponse.json({
    name: "Unknown Token",
    symbol: mint.slice(0, 4).toUpperCase(),
    mint,
    logoUrl: null,
    score: randomScore,
    grade,
    status,
    findings: [
      {
        id: "1",
        title: "Unverified Token",
        description: "This token has not been verified on major platforms",
        severity: status === "danger" ? "high" : "medium",
      },
      {
        id: "2",
        title: "Limited Data",
        description: "Limited historical data available for this token",
        severity: "low",
      },
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mint } = body;

    if (!mint) {
      return NextResponse.json(
        { error: "Missing mint address in request body" },
        { status: 400 }
      );
    }

    // Check if we have mock data for this mint
    const mockData = mockScanResults[mint];

    if (mockData) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      return NextResponse.json(mockData);
    }

    // For unknown mints, generate a random result
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const randomScore = Math.floor(Math.random() * 60) + 30; // 30-90
    const grade =
      randomScore >= 80 ? "A" : randomScore >= 60 ? "B" : randomScore >= 40 ? "C" : "D";
    const status =
      randomScore >= 70 ? "safe" : randomScore >= 50 ? "warning" : "danger";

    return NextResponse.json({
      name: "Unknown Token",
      symbol: mint.slice(0, 4).toUpperCase(),
      mint,
      logoUrl: null,
      score: randomScore,
      grade,
      status,
      findings: [
        {
          id: "1",
          title: "Unverified Token",
          description: "This token has not been verified on major platforms",
          severity: status === "danger" ? "high" : "medium",
        },
        {
          id: "2",
          title: "Limited Data",
          description: "Limited historical data available for this token",
          severity: "low",
        },
      ],
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
