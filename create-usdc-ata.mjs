/**
 * create-usdc-ata.mjs
 * Cria a ATA de USDC para a fee collector do Bags Shield.
 *
 * ──────────────────────────────────────────────────────
 * COMO RODAR NO WINDOWS POWERSHELL:
 *
 *   node create-usdc-ata.mjs <PRIVATE_KEY>
 *
 * <PRIVATE_KEY> pode ser:
 *   - Chave base58 exportada do Phantom (Settings → Security → Export Private Key)
 *   - Ou caminho para um arquivo .json com array de bytes (ex: C:\Users\cleit\keypair.json)
 *
 * Exemplos:
 *   node create-usdc-ata.mjs 5JpQk...abc123
 *   node create-usdc-ata.mjs C:\Users\cleit\id.json
 *
 * A wallet que você passar só precisa ter ~0.003 SOL para o rent.
 * Não precisa ter a chave da fee collector.
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
const USDC_MINT     = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const RPC_URL       = process.env.SOLANA_RPC_URL
  || 'https://mainnet.helius-rpc.com/?api-key=a6eb98dd-5471-4849-b03f-6cf777f11f09';

// ── Load payer keypair ───────────────────────────────────────────────────────
const arg = process.argv[2] || process.env.PAYER_KEYPAIR;

if (!arg) {
  console.error('');
  console.error('❌  Informe a chave privada ou o caminho do keypair.');
  console.error('');
  console.error('   node create-usdc-ata.mjs <PRIVATE_KEY_BASE58>');
  console.error('   node create-usdc-ata.mjs C:\\Users\\cleit\\keypair.json');
  console.error('');
  process.exit(1);
}

let payer;
try {
  if (existsSync(arg)) {
    // É um arquivo .json com array de bytes
    const raw = JSON.parse(readFileSync(arg, 'utf8'));
    payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    // É uma chave base58 (formato Phantom "Export Private Key")
    payer = Keypair.fromSecretKey(bs58.decode(arg));
  }
  console.log('✅  Payer:', payer.publicKey.toBase58());
} catch (e) {
  console.error('❌  Não foi possível carregar o keypair:', e.message);
  process.exit(1);
}

// ── Derive ATA ───────────────────────────────────────────────────────────────
const ata = getAssociatedTokenAddressSync(USDC_MINT, FEE_COLLECTOR, true, TOKEN_PROGRAM_ID);
console.log('🔑  Fee collector :', FEE_COLLECTOR.toBase58());
console.log('🏦  USDC ATA      :', ata.toBase58());

// ── Check & create ───────────────────────────────────────────────────────────
const connection = new Connection(RPC_URL, 'confirmed');

const balance = await connection.getBalance(payer.publicKey);
console.log(`💰  Saldo payer   : ${(balance / 1e9).toFixed(4)} SOL`);

if (balance < 2_500_000) {
  console.error('❌  Saldo insuficiente. Precisa de pelo menos ~0.003 SOL para o rent.');
  process.exit(1);
}

const existing = await connection.getAccountInfo(ata);
if (existing) {
  console.log('ℹ️   ATA já existe — nenhuma transação necessária.');
  console.log('✅  O backend já pode coletar fees em USDC!');
  process.exit(0);
}

console.log('⏳  Criando ATA...');
const txSig = await createAssociatedTokenAccountIdempotent(
  connection,
  payer,
  USDC_MINT,
  FEE_COLLECTOR,
  { commitment: 'confirmed' },
  TOKEN_PROGRAM_ID,
);

console.log('');
console.log('✅  ATA criada com sucesso!');
console.log('📝  Transação :', `https://solscan.io/tx/${txSig}`);
console.log('🏦  ATA       :', `https://solscan.io/account/${ata.toBase58()}`);
console.log('');
console.log('✅  O backend agora vai coletar fees em USDC em cada swap.');
