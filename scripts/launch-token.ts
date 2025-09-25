// scripts/launch-token.ts
import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { BagsSDK } from "@bagsfm/bags-sdk";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Connection, Commitment } from "@solana/web3.js";
import bs58 from "bs58";

// === ENV obrigatórias ===
const BAGS_API_KEY = process.env.BAGS_API_KEY;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL; // ex.: https://api.devnet.solana.com  (recomendado p/ testar)
const PRIVATE_KEY = process.env.PRIVATE_KEY;       // base58 da secretKey

if (!BAGS_API_KEY || !SOLANA_RPC_URL || !PRIVATE_KEY) {
  throw new Error("BAGS_API_KEY, SOLANA_RPC_URL e PRIVATE_KEY são obrigatórios no .env");
}

// Commitment opcional (processed | confirmed | finalized). Default: processed
const COMMITMENT = (process.env.SOLANA_COMMITMENT as Commitment) || "processed";

const connection = new Connection(SOLANA_RPC_URL);
const sdk = new BagsSDK(BAGS_API_KEY, connection, COMMITMENT);

type LaunchParams = {
  imageUrl: string;
  name: string;
  symbol: string;
  description: string;
  twitterUrl?: string;
  websiteUrl?: string;
  initialBuyAmountLamports: number; // ex.: 0.01 * LAMPORTS_PER_SOL
};

async function launchToken(launchParams: LaunchParams) {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY!));
    const wallet = keypair.publicKey.toBase58();

    console.log(`🚀 Criando token $${(launchParams.symbol || "").toUpperCase().replace("$", "")} com a wallet ${wallet}`);
    const commitment = sdk.state.getCommitment();

    console.log("⚙️  Buscando/gerando configuração...");
    const configResponse = await sdk.config.getOrCreateConfig(keypair.publicKey);

    if (configResponse.transaction) {
      console.log("🔧 Config inexistente — criando...");
      configResponse.transaction.sign([keypair]);

      const blockhash = await connection.getLatestBlockhash(commitment);
      const txSig = await connection.sendTransaction(configResponse.transaction, { maxRetries: 0, skipPreflight: true });

      const confirmed = await connection.confirmTransaction(
        { blockhash: blockhash.blockhash, lastValidBlockHeight: blockhash.lastValidBlockHeight, signature: txSig },
        commitment
      );

      if (confirmed.value.err) {
        console.error("❌ Erro ao criar config:", confirmed.value.err);
        throw new Error("Config creation failed");
      } else {
        console.log("✅ Config criada com sucesso!");
      }
    } else {
      console.log("♻️  Config já existe — chave:", configResponse.configKey.toString());
    }

    console.log("📝 Criando token info + metadata...");
    const tokenInfoResponse = await sdk.tokenLaunch.createTokenInfoAndMetadata({
      imageUrl: launchParams.imageUrl,
      name: launchParams.name,
      description: launchParams.description,
      symbol: launchParams.symbol?.toUpperCase()?.replace("$", ""),
      twitter: launchParams.twitterUrl,
      website: launchParams.websiteUrl
    });

    console.log("✨ Token info/metadata criados!");
    console.log("🪙 Mint:", tokenInfoResponse.tokenMint);
    console.log("🎯 Criando transaction de lançamento...");

    const tokenLaunchTransaction = await sdk.tokenLaunch.createLaunchTransaction({
      metadataUrl: tokenInfoResponse.tokenMetadata,
      tokenMint: new PublicKey(tokenInfoResponse.tokenMint),
      launchWallet: keypair.publicKey,
      initialBuyLamports: launchParams.initialBuyAmountLamports,
      configKey: configResponse.configKey
    });

    tokenLaunchTransaction.sign([keypair]);

    const blockhash = await connection.getLatestBlockhash(commitment);
    const txSignature = await connection.sendTransaction(tokenLaunchTransaction, { maxRetries: 0, skipPreflight: true });

    console.log("🔑 Confirmando assinatura:", txSignature);

    const confirmed = await connection.confirmTransaction(
      { blockhash: blockhash.blockhash, lastValidBlockHeight: blockhash.lastValidBlockHeight, signature: txSignature },
      commitment
    );

    if (confirmed.value.err) {
      console.error("💥 Erro ao lançar o token:", confirmed.value.err);
      throw new Error("Token launch failed");
    }

    console.log("🎉 Token lançado com sucesso!");
    console.log(`🌐 Veja em: https://bags.fm/${tokenInfoResponse.tokenMint}`);
  } catch (error) {
    console.error("🚨 Erro inesperado:", error);
    process.exitCode = 1;
  }
}

// ==== EDITAR AQUI para seu token (devnet p/ testes) ====
launchToken({
  imageUrl: "https://img.freepik.com/premium-vector/white-abstract-vactor-background-design_665257-153.jpg",
  name: "TEST",
  symbol: "TEST",
  description: "TEST TOKEN",
  twitterUrl: "https://x.com/test",
  websiteUrl: "https://test.com",
  initialBuyAmountLamports: 0.01 * LAMPORTS_PER_SOL
});

