/**
 * setup-jupiter-referral.mjs
 *
 * Inicializa a conta de referral Jupiter para coleta de fees no Bags Shield.
 * Só precisa rodar UMA VEZ. Após isso, o backend coleta fees em cada swap.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * COMO RODAR:
 *
 *   node setup-jupiter-referral.mjs <PAYER_KEYPAIR_BASE58>
 *   node setup-jupiter-referral.mjs C:\Users\cleit\keypair.json
 *
 * <PAYER_KEYPAIR_BASE58> pode ser a chave do fee collector (7ZybPucn...) ou qualquer
 * wallet com SOL suficiente para pagar o rent (~0.01 SOL total).
 *
 * Após rodar, copie o JUPITER_REFERRAL_ACCOUNT exibido e adicione nas
 * variáveis de ambiente do Vercel (bags-shield-api).
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Mints configurados (Jupiter Ultra prioriza estas para fee):
 *   USDC  · USDT · SOL (WSOL) · JUP
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { readFileSync, existsSync } from 'fs';
import bs58 from 'bs58';

// ── Constants ─────────────────────────────────────────────────────────────────
const REFERRAL_PROGRAM_ID  = new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3');

// ⚠️  Chaves de projeto do Referral Program (por produto):
//   Jupiter Ultra  → DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc  ← USE ESTA
//   Jupiter Swap v6 → 45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Fp
// A chave Swap v6 NÃO está inicializada na mainnet — causava AccountNotInitialized.
const JUPITER_PROJECT      = new PublicKey('DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc');

const FEE_COLLECTOR_OWNER  = new PublicKey('7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi');
const REFERRAL_NAME        = 'bagsshield';

const RPC_URL = process.env.SOLANA_RPC_URL;

if (!RPC_URL) {
  console.error('Defina SOLANA_RPC_URL antes de rodar este script.');
  process.exit(1);
}

// Mints que Jupiter Ultra usa para coletar fees (priority list aproximada)
const FEE_MINTS = [
  { symbol: 'USDC', mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') },
  { symbol: 'USDT', mint: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') },
  { symbol: 'WSOL', mint: new PublicKey('So11111111111111111111111111111111111111112') },
  { symbol: 'JUP',  mint: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN') },
];

// ── PDA helpers (sem SDK — só web3.js) ───────────────────────────────────────
function deriveReferralAccount(projectPubKey, name) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('referral'), projectPubKey.toBuffer(), Buffer.from(name)],
    REFERRAL_PROGRAM_ID,
  );
  return pda;
}

function deriveReferralTokenAccount(referralAccountPubKey, mint) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('referral_ata'), referralAccountPubKey.toBuffer(), mint.toBuffer()],
    REFERRAL_PROGRAM_ID,
  );
  return pda;
}

// ── Load payer keypair ────────────────────────────────────────────────────────
const arg = process.argv[2] || process.env.PAYER_KEYPAIR;

if (!arg) {
  console.error('');
  console.error('❌  Informe a chave privada ou caminho do keypair.');
  console.error('');
  console.error('   node setup-jupiter-referral.mjs <PAYER_KEYPAIR_BASE58>');
  console.error('   node setup-jupiter-referral.mjs C:\\Users\\cleit\\keypair.json');
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
  console.log('✅  Payer:', payer.publicKey.toBase58());
} catch (e) {
  console.error('❌  Não foi possível carregar o keypair:', e.message);
  process.exit(1);
}

// ── Tx helper ─────────────────────────────────────────────────────────────────
// Suporta tanto legacy Transaction (Anchor 0.28) quanto VersionedTransaction.
async function sendTx(connection, tx, payer) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  // Anchor 0.28 retorna legacy Transaction
  if (tx instanceof Transaction || (tx && tx.instructions)) {
    const legacyTx = tx instanceof Transaction ? tx : Object.assign(new Transaction(), tx);
    legacyTx.feePayer = payer.publicKey;
    legacyTx.recentBlockhash = blockhash;
    legacyTx.sign(payer);
    const raw = legacyTx.serialize();
    const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  }

  // VersionedTransaction (fallback futuro)
  tx.message.recentBlockhash = blockhash;
  tx.sign([payer]);
  const raw = tx.serialize();
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

// ── Connect ───────────────────────────────────────────────────────────────────
const connection = new Connection(RPC_URL, 'confirmed');

const balance = await connection.getBalance(payer.publicKey);
console.log(`💰  Saldo payer: ${(balance / 1e9).toFixed(4)} SOL`);

if (balance < 10_000_000) {
  console.error('❌  Saldo insuficiente. Precisa de pelo menos ~0.01 SOL.');
  process.exit(1);
}

// ── Derive addresses ──────────────────────────────────────────────────────────
const referralAccountPubKey = deriveReferralAccount(JUPITER_PROJECT, REFERRAL_NAME);
console.log('');
console.log('📋  Referral Account (PDA):', referralAccountPubKey.toBase58());
console.log('');

// ── Step 1: Initialize referral account (if not exists) ───────────────────────
const refAccountInfo = await connection.getAccountInfo(referralAccountPubKey);
if (refAccountInfo) {
  console.log('ℹ️   Referral account já existe — pulando criação.');
} else {
  console.log('⏳  Criando referral account...');
  try {
    // Importar SDK dinâmico
    let ReferralProvider;
    try {
      const sdk = await import('@jup-ag/referral-sdk');
      ReferralProvider = sdk.ReferralProvider;
    } catch {
      console.error('❌  @jup-ag/referral-sdk não encontrado. Instale com:');
      console.error('       npm install @jup-ag/referral-sdk --no-save');
      console.error('    e rode novamente.');
      process.exit(1);
    }

    const provider = new ReferralProvider(connection);
    // SDK retorna { tx, referralAccountPubKey } — desestruturar corretamente
    const { tx } = await provider.initializeReferralAccountWithName({
      projectPubKey: JUPITER_PROJECT,
      partnerPubKey: FEE_COLLECTOR_OWNER,
      payerPubKey: payer.publicKey,
      name: REFERRAL_NAME,
    });

    const sig = await sendTx(connection, tx, payer);
    console.log('✅  Referral account criada!');
    console.log('   Tx:', `https://solscan.io/tx/${sig}`);
  } catch (e) {
    console.error('❌  Falha ao criar referral account:', e.message);
    console.error('   Verifique se JUPITER_PROJECT está correto para Ultra.');
    process.exit(1);
  }
}

// ── Step 2: Initialize referral token accounts ─────────────────────────────────
console.log('');
console.log('🪙  Criando referral token accounts para fee mints...');
console.log('');

let ReferralProvider;
try {
  const sdk = await import('@jup-ag/referral-sdk');
  ReferralProvider = sdk.ReferralProvider;
} catch {
  // Se SDK não estiver disponível, apenas calcula e mostra os PDAs
  ReferralProvider = null;
}

const results = [];

for (const { symbol, mint } of FEE_MINTS) {
  const tokenAccountPda = deriveReferralTokenAccount(referralAccountPubKey, mint);
  const accountInfo = await connection.getAccountInfo(tokenAccountPda);

  if (accountInfo) {
    console.log(`✅  ${symbol.padEnd(5)} token account já existe: ${tokenAccountPda.toBase58()}`);
    results.push({ symbol, mint: mint.toBase58(), tokenAccount: tokenAccountPda.toBase58(), created: false });
    continue;
  }

  if (!ReferralProvider) {
    console.log(`⏭️   ${symbol.padEnd(5)} PDA calculada (não inicializada): ${tokenAccountPda.toBase58()}`);
    results.push({ symbol, mint: mint.toBase58(), tokenAccount: tokenAccountPda.toBase58(), created: false });
    continue;
  }

  try {
    console.log(`⏳  ${symbol} — inicializando...`);
    const provider = new ReferralProvider(connection);
    const result = await provider.initializeReferralTokenAccount({
      payerPubKey: payer.publicKey,
      referralAccountPubKey,
      mint,
    });
    // SDK pode retornar { tx } ou a própria transação
    const tx = result?.tx ?? result;

    const sig = await sendTx(connection, tx, payer);
    console.log(`✅  ${symbol.padEnd(5)} criada: ${tokenAccountPda.toBase58()}`);
    console.log(`      Tx: https://solscan.io/tx/${sig}`);
    results.push({ symbol, mint: mint.toBase58(), tokenAccount: tokenAccountPda.toBase58(), created: true });
  } catch (e) {
    console.warn(`⚠️   ${symbol} falhou: ${e.message}`);
    results.push({ symbol, mint: mint.toBase58(), tokenAccount: tokenAccountPda.toBase58(), created: false, error: e.message });
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  ✅  SETUP COMPLETO — copie estes valores para o Vercel:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`  JUPITER_REFERRAL_ACCOUNT=${referralAccountPubKey.toBase58()}`);
console.log('');
console.log('  Referral token accounts (para conferir no Solscan):');
for (const r of results) {
  console.log(`    ${r.symbol.padEnd(5)} → ${r.tokenAccount}  (mint: ${r.mint})`);
}
console.log('');
console.log('  Próximos passos:');
console.log('  1. Vá em https://vercel.com → bags-shield-api → Settings → Environment Variables');
console.log(`  2. Adicione: JUPITER_REFERRAL_ACCOUNT = ${referralAccountPubKey.toBase58()}`);
console.log('  3. Redeploy o projeto');
console.log('  4. Faça um swap de teste e confirme as fees no Solscan');
console.log('');
console.log('  Referral dashboard: https://referral.jup.ag/');
console.log('═══════════════════════════════════════════════════════════════');
