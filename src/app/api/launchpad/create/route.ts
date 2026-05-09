import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  AuthorityType,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { getLaunchFee, getTreasuryWallet } from "@/lib/solana/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DECIMALS = 9;
const MAX_SUPPLY = 1_000_000_000n;

function jsonNoStore(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

interface CreateBody {
  name?: string;
  symbol?: string;
  imageUrl?: string | null;
  image?: string | null;
  supply?: number | string;
  initialLiquidity?: number | null;
  trustLayers?: Record<string, boolean>;
  lpDuration?: number;
  slippageBps?: number;
  tip?: number | null;
  wallet?: string;
  mintPublicKey?: string;
}

function getRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com"
  );
}

export async function POST(req: NextRequest) {
  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return jsonNoStore(
      { success: false, error: "INVALID_JSON", message: "Body must be valid JSON" },
      400
    );
  }

  const name = String(body?.name || "").trim();
  const symbol = String(body?.symbol || "").trim().toUpperCase();
  const walletStr = String(body?.wallet || "").trim();
  const mintPublicKeyStr = String(body?.mintPublicKey || "").trim();
  const trustLayers = body?.trustLayers || {};

  // --- Validations ---
  if (!name || name.length < 2 || name.length > 32) {
    return jsonNoStore(
      { success: false, error: "INVALID_INPUT", message: "Token name must be 2-32 chars" },
      400
    );
  }
  if (!symbol || symbol.length < 2 || symbol.length > 10) {
    return jsonNoStore(
      { success: false, error: "INVALID_INPUT", message: "Symbol must be 2-10 chars" },
      400
    );
  }
  if (!walletStr) {
    return jsonNoStore(
      { success: false, error: "MISSING_WALLET", message: "Connect wallet first" },
      400
    );
  }
  if (!mintPublicKeyStr || mintPublicKeyStr.length < 32 || mintPublicKeyStr.length > 44) {
    return jsonNoStore(
      { success: false, error: "MISSING_MINT", message: "mintPublicKey is required (client must generate the mint keypair)" },
      400
    );
  }

  let creator: PublicKey;
  try {
    creator = new PublicKey(walletStr);
  } catch {
    return jsonNoStore(
      { success: false, error: "INVALID_WALLET", message: "Invalid wallet pubkey" },
      400
    );
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(mintPublicKeyStr);
  } catch {
    return jsonNoStore(
      { success: false, error: "INVALID_MINT", message: "Invalid mintPublicKey" },
      400
    );
  }

  let supplyBig: bigint;
  try {
    const raw = body?.supply ?? 1_000_000_000;
    supplyBig = typeof raw === "bigint" ? raw : BigInt(Math.floor(Number(raw)));
    if (supplyBig <= 0n) throw new Error("non-positive");
    if (supplyBig > MAX_SUPPLY) supplyBig = MAX_SUPPLY;
  } catch {
    return jsonNoStore(
      { success: false, error: "INVALID_SUPPLY", message: "Supply must be 1..1,000,000,000" },
      400
    );
  }

  // --- Build transaction ---
  let connection: Connection;
  let mintRent: number;

  try {
    connection = new Connection(getRpcUrl(), "confirmed");
    mintRent = await getMinimumBalanceForRentExemptMint(connection);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonNoStore(
      {
        success: false,
        error: "RPC_ERROR",
        message: `RPC unavailable: ${msg}. Set SOLANA_RPC_URL env var to a Helius/QuickNode endpoint.`,
      },
      503
    );
  }

  const ata = getAssociatedTokenAddressSync(mint, creator, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const decimals = DEFAULT_DECIMALS;
  const mintAmount = supplyBig * BigInt(10 ** decimals);

  // Placeholder blockhash — the client overrides it with a fresh one right before signing.
  // web3.js Transaction.serialize() requires a recentBlockhash to compile the message,
  // but since the client (which holds the mint keypair and the wallet) will set a fresh
  // blockhash + partial-sign + sign, the server placeholder never reaches the chain.
  const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

  const tx = new Transaction({
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
    feePayer: creator,
  });

  // Compute budget (small bump for ATA + multiple ix)
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }));
  if (typeof body?.tip === "number" && body.tip > 0) {
    // micro-lamports per CU (very small priority fee — frontend tip is in SOL but here we just bump)
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }));
  }

  // 1. Create mint account
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: creator,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  // 2. Initialize mint
  tx.add(
    createInitializeMint2Instruction(
      mint,
      decimals,
      creator,
      creator, // freeze authority (will revoke below if requested)
      TOKEN_PROGRAM_ID
    )
  );

  // 3. Create creator's ATA
  tx.add(
    createAssociatedTokenAccountInstruction(
      creator,
      ata,
      creator,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 4. Mint full supply to creator
  tx.add(createMintToInstruction(mint, ata, creator, mintAmount, [], TOKEN_PROGRAM_ID));

  // 5. Metaplex on-chain metadata (name, symbol, uri) — MUST be before revoking mint authority
  try {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    const metadataUri = String(body?.imageUrl ?? body?.image ?? "").trim();
    tx.add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPDA,
          mint,
          mintAuthority: creator,
          payer: creator,
          updateAuthority: creator,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name,
              symbol,
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: !trustLayers?.immutableMeta,
            collectionDetails: null,
          },
        }
      )
    );
  } catch (e) {
    console.warn("[launchpad/create] Metadata instruction skipped:", e);
  }

  // 6. Trust layer: revoke mint authority
  if (trustLayers?.revokeMint) {
    tx.add(
      createSetAuthorityInstruction(
        mint,
        creator,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // 7. Trust layer: revoke freeze authority
  if (trustLayers?.revokeFreeze) {
    tx.add(
      createSetAuthorityInstruction(
        mint,
        creator,
        AuthorityType.FreezeAccount,
        null,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // 8. Collect launch fee -> treasury (best-effort)
  const treasuryStr = getTreasuryWallet();
  const allLayersActive =
    Object.values(trustLayers).every(Boolean) &&
    Object.keys(trustLayers).length >= 5;
  if (treasuryStr) {
    try {
      const treasury = new PublicKey(treasuryStr);
      const fee = getLaunchFee(allLayersActive);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: creator,
          toPubkey: treasury,
          lamports: fee,
        })
      );
    } catch (e) {
      console.warn("[launchpad/create] Treasury fee skipped:", e);
    }
  }

  // Mint keypair is held by the client — it will partial-sign there before submitting.
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const transactionBase64 = Buffer.from(serialized).toString("base64");

  // --- Best-effort persistence ---
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/launches`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({
          name,
          symbol,
          mint: mint.toBase58(),
          image_url: body?.imageUrl ?? body?.image ?? null,
          supply: Number(supplyBig),
          decimals,
          initial_liquidity: body?.initialLiquidity ?? null,
          trust_layers: trustLayers,
          lp_duration: body?.lpDuration ?? null,
          slippage_bps: body?.slippageBps ?? null,
          tip: body?.tip ?? null,
          wallet: walletStr,
          status: "pending_signature",
          simulated: false,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn("[launchpad/create] Supabase persist failed:", e);
    }
  }

  // Bags.fm fee share registration (fire-and-forget, do not block the response)
  const bagsApiKey = process.env.BAGS_API_KEY;
  if (bagsApiKey && walletStr) {
    (async () => {
      try {
        await fetch(
          "https://public-api-v2.bags.fm/api/v1/fee-share/create-config",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": bagsApiKey,
            },
            body: JSON.stringify({
              launchWallet: walletStr,
              feeShareWallet: treasuryStr ?? walletStr,
            }),
            signal: AbortSignal.timeout(5000),
          }
        );
      } catch (e) {
        console.warn("[launchpad/create] Bags fee-share config skipped:", e);
      }
    })();
  }

  const fees = {
    launchFeeLamports: Number(getLaunchFee(allLayersActive)),
    shieldTier: allLayersActive,
    treasuryConfigured: Boolean(treasuryStr),
    bagsFeeshareEnrolled: Boolean(bagsApiKey),
  };

  return jsonNoStore({
    success: true,
    response: {
      mint: mint.toBase58(),
      transaction: transactionBase64,
      decimals,
      supply: Number(supplyBig),
      simulated: false,
      message: "Sign the transaction in your wallet to deploy the token on-chain.",
      fees,
      submitted: {
        name,
        symbol,
        imageUrl: body?.imageUrl ?? body?.image ?? null,
        supply: Number(supplyBig),
        initialLiquidity: body?.initialLiquidity ?? null,
        trustLayers,
        lpDuration: body?.lpDuration ?? null,
      },
    },
    // Top-level mirrors
    mint: mint.toBase58(),
    transaction: transactionBase64,
    txSignature: null,
    message: "Sign the transaction in your wallet",
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function GET() {
  return jsonNoStore(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "Use POST to create a launch",
      allowed: ["POST", "OPTIONS"],
    },
    405
  );
}
