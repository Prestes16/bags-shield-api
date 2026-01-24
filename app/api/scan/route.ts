import { NextResponse } from "next/server";

const API_BASE =
  process.env.BAGS_SHIELD_API_BASE?.trim() || "https://bags-shield-api.vercel.app";

function isBase58Mint(s: string) {
  // Base58 (sem 0,O,I,l) + tamanho típico de mint Solana
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function noStoreHeaders(extra?: Record<string, string>) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    ...extra,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = (searchParams.get("mint") || "").trim();

  if (!isBase58Mint(mint)) {
    return NextResponse.json(
      { success: false, error: "mint inválido" },
      { status: 400, headers: noStoreHeaders({ "Content-Type": "application/json" }) }
    );
  }

  // Timeout simples pra não travar tela (server-side)
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);

  try {
    // Upstream atual da tua API (ajuste aqui se quiser usar /api/v0/scan no futuro)
    const upstreamUrl = `${API_BASE}/api/scan`;

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ mint }),
      signal: ac.signal,
    });

    const text = await upstream.text();

    // repassa status 429/400/500 etc. do upstream
    return new NextResponse(text, {
      status: upstream.status,
      headers: noStoreHeaders({
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      }),
    });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError" ? "timeout falando com a API" : "falha ao chamar a API";

    return NextResponse.json(
      { success: false, error: msg },
      { status: 502, headers: noStoreHeaders({ "Content-Type": "application/json" }) }
    );
  } finally {
    clearTimeout(t);
  }
}
