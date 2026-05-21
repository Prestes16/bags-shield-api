/**
 * setup-fee-atas.mjs
 * Inicializa as ATAs (Associated Token Accounts) de WSOL, USDC e USDT
 * para a fee collector wallet do Bags Shield.
 *
 * Estas ATAs precisam existir on-chain para que o Jupiter possa depositar
 * as platform fees coletadas em cada swap.
 *
 * ──────────────────────────────────────────────────────
 * COMO RODAR:
 *
 *   node setup-fee-atas.mjs <PAYER_KEYPAIR_BASE58_OU_CAMINHO_JSON>
 *
 * Exemplos:
 *   node setup-fee-atas.mjs 5JpQk...abc123
 *   node setup-fee-atas.mjs C:\Users\cleit\id.json
 *
 * Requer ~0.01 SOL de rent (3 ATAs × ~0.002 SOL cada).
 * O payer pode ser qualquer wallet — não precisa ser a fee collector.
 * ──────────────────────────────────────────────────────
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { readFileSync, existsSync } from 'fs';
import bs58 from 'bs58';

// ── Config ──────────────────────────────────────────────────────────────────
const FEE_COLLECTOR = new PublicKey('7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi');

const MINTS = [
  {
    label: 'WSOL',
    mint: new PublicKey('So11111111111111111111111111111111111111112'),
  },
  {
    label: 'USDC',
    mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  },
  {
    label: 'USDT',
    mint: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  },
];

const RPC_URL = process.env.SOLANA_RPC_URL;
if (!RPC_URL) {
  console.error('❌  Defina SOLANA_RPC_URL antes de rodar este script.');
  process.exit(1);
}

// ── Load payer keypair ───────────────────────────────────────────────────────
const arg = process.argv[2] || process.env.PAYER_KEYPAIR;

if (!arg) {
  console.error('');
  console.error('❌  Informe a chave privada ou o caminho do keypair.');
  console.error('');
  console.error('   node setup-fee-atas.mjs <PAYER_KEYPAIR_BASE58>');
  console.error('   node setup-fee-atas.mjs C:\\Users\\cleit\\keypair.json');
  console.error('');
  process.exit(1);
}

let payer;
try {
  if (existsSync(arg)) {
    const raw = JSON.parse(readFileSync(arg, 'utf8'));
    payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    payer = Keypair.fromSecretKey(bs58.decode(arg));
  }
  console.log('✅  Payer         :', payer.publicKey.toBase58());
} catch (e) {
  console.error('❌  Não foi possível carregar o keypair:', e.message);
  process.exit(1);
}

// ── Check balance ────────────────────────────────────────────────────────────
const connection = new Connection(RPC_URL, 'confirmed');
const balance = await connection.getBalance(payer.publicKey);
console.log(`💰  Saldo payer   : ${(balance / 1e9).toFixed(4)} SOL`);

// 3 ATAs × ~0.002 SOL rent = ~0.006 SOL minimum; require 0.01 SOL for safety
if (balance < 10_000_000) {
  console.error('❌  Saldo insuficiente. Precisa de pelo menos 0.01 SOL para criar 3 ATAs.');
  process.exit(1);
}

console.log('');
console.log('🔑  Fee collector :', FEE_COLLECTOR.toBase58());
console.log('');

// ── Create ATAs ──────────────────────────────────────────────────────────────
let created = 0;
let skipped = 0;

for (const { label, mint } of MINTS) {
  const ata = getAssociatedTokenAddressSync(mint, FEE_COLLECTOR, true, TOKEN_PROGRAM_ID);
  const existing = await connection.getAccountInfo(ata);

  if (existing) {
    console.log(`ℹ️   ${label.padEnd(4)} ATA já existe — pulando.`);
    console.log(`    ATA: https://solscan.io/account/${ata.toBase58()}`);
    skipped++;
    continue;
  }

  console.log(`⏳  Criando ATA para ${label} (${mint.toBase58()})...`);
  try {
    const txSig = await createAssociatedTokenAccountIdempotent(
      connection,
      payer,
      mint,
      FEE_COLLECTOR,
      { commitment: 'confirmed' },
      TOKEN_PROGRAM_ID,
    );
    console.log(`✅  ${label.padEnd(4)} ATA criada!`);
    console.log(`    Tx : https://solscan.io/tx/${txSig}`);
    console.log(`    ATA: https://solscan.io/account/${ata.toBase58()}`);
    created++;
  } catch (e) {
    console.error(`❌  Falha ao criar ATA para ${label}:`, e.message);
  }
  console.log('');
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('──────────────────────────────────────────────────────');
console.log(`✅  ATAs criadas : ${created}`);
console.log(`ℹ️   ATAs puladas : ${skipped} (já existiam)`);
console.log('');
if (created + skipped === MINTS.length) {
  console.log('🚀  Fee collector pronto para receber WSOL, USDC e USDT em cada swap!');
} else {
  console.log('⚠️   Algumas ATAs falharam — verifique os erros acima e rode novamente.');
}
