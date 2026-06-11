/**
 * Consolidacao das setup transactions do fee-share (Bags v2) em UMA transacao.
 *
 * Motivo: o APK/Seeker limita o launch a 1 assinatura de setup + 1 final
 * (cap no frontend). Quando a Bags retorna 2+ setup txs, tentamos fundir as
 * instrucoes em uma unica VersionedTransaction v0 com blockhash fresco.
 *
 * Seguranca / fail-closed:
 * - NUNCA consolida tx com assinatura parcial embutida (invalidaria a sig).
 * - NUNCA consolida se houver signer alem do payer.
 * - NUNCA retorna transacao acima do limite de 1232 bytes.
 * - Em qualquer impossibilidade retorna { ok:false, code } estruturado e o
 *   caller decide (mantem o array original para o fluxo desktop).
 * - Nao loga transacao, payload ou segredo — apenas codigos e contagens.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
  type AddressLookupTableAccount,
} from "@solana/web3.js";
import bs58 from "bs58";

export type SetupTxInput = { transaction?: string; [key: string]: unknown };

export type ConsolidationResult =
  | {
      ok: true;
      transaction: string;
      encoding: "base58";
      blockhash: { blockhash: string; lastValidBlockHeight: number };
      mergedCount: number;
    }
  | { ok: false; code: string; message: string };

const MAX_TX_BYTES = 1232;

function fail(code: string, message: string): ConsolidationResult {
  return { ok: false, code, message };
}

function decodeTxBytes(serialized: string): Uint8Array | null {
  const s = serialized.trim();
  try {
    const b = bs58.decode(s);
    if (b.length > 0) return b;
  } catch { /* tenta base64 */ }
  try {
    const b = Uint8Array.from(Buffer.from(s, "base64"));
    if (b.length > 0) return b;
  } catch { /* invalida */ }
  return null;
}

function hasRealSignature(sigs: Array<Uint8Array | Buffer | null>): boolean {
  return sigs.some((sig) => {
    if (!sig) return false;
    for (const byte of sig as Uint8Array) {
      if (byte !== 0) return true;
    }
    return false;
  });
}

interface ParsedSetupTx {
  instructions: TransactionInstruction[];
  lookups: AddressLookupTableAccount[];
  requiredSigners: string[];
}

async function parseSetupTx(
  bytes: Uint8Array,
  connection: Connection,
): Promise<ParsedSetupTx | ConsolidationResult> {
  // Tenta v0/versioned primeiro; cai para legacy.
  try {
    const vtx = VersionedTransaction.deserialize(bytes);
    if (hasRealSignature(vtx.signatures as unknown as Uint8Array[])) {
      return fail("SETUP_TX_PARTIALLY_SIGNED", "Setup transaction is partially signed; cannot consolidate.");
    }
    const msg = vtx.message;
    const lookups: AddressLookupTableAccount[] = [];
    if (msg.addressTableLookups.length > 0) {
      for (const lookup of msg.addressTableLookups) {
        const res = await connection.getAddressLookupTable(lookup.accountKey);
        if (!res.value) {
          return fail("SETUP_TX_LOOKUP_UNRESOLVED", "Address lookup table could not be resolved for consolidation.");
        }
        lookups.push(res.value);
      }
    }
    const decompiled = TransactionMessage.decompile(msg, { addressLookupTableAccounts: lookups });
    const staticKeys = msg.staticAccountKeys;
    const requiredSigners = staticKeys
      .slice(0, msg.header.numRequiredSignatures)
      .map((k) => k.toBase58());
    return { instructions: decompiled.instructions, lookups, requiredSigners };
  } catch { /* legacy */ }

  try {
    const ltx = Transaction.from(bytes);
    const sigs = ltx.signatures.map((s) => s.signature).filter(Boolean) as Buffer[];
    if (hasRealSignature(sigs)) {
      return fail("SETUP_TX_PARTIALLY_SIGNED", "Setup transaction is partially signed; cannot consolidate.");
    }
    const requiredSigners = ltx.signatures.map((s) => s.publicKey.toBase58());
    return { instructions: ltx.instructions, lookups: [], requiredSigners };
  } catch {
    return fail("SETUP_TX_UNPARSEABLE", "Setup transaction could not be parsed for consolidation.");
  }
}

/**
 * Funde 2+ setup txs (nao assinadas, payer-only) em uma unica v0.
 * Retorna estrutura compativel com o item original de `transactions`.
 */
export async function consolidateSetupTransactions(
  setupTxs: SetupTxInput[],
  payer: string,
  rpcUrl: string,
): Promise<ConsolidationResult> {
  if (!Array.isArray(setupTxs) || setupTxs.length < 2) {
    return fail("SETUP_TX_NOTHING_TO_CONSOLIDATE", "Less than two setup transactions; nothing to consolidate.");
  }
  if (!rpcUrl) {
    return fail("SETUP_TX_NO_RPC", "No RPC endpoint configured for consolidation.");
  }

  let payerKey: PublicKey;
  try {
    payerKey = new PublicKey(payer);
  } catch {
    return fail("SETUP_TX_INVALID_PAYER", "Invalid payer public key.");
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const allInstructions: TransactionInstruction[] = [];
  const allLookups: AddressLookupTableAccount[] = [];
  const lookupKeys = new Set<string>();

  for (const item of setupTxs) {
    const serialized = typeof item?.transaction === "string" ? item.transaction : "";
    if (!serialized.trim()) {
      return fail("SETUP_TX_EMPTY", "Empty setup transaction entry.");
    }
    const bytes = decodeTxBytes(serialized);
    if (!bytes) {
      return fail("SETUP_TX_UNDECODABLE", "Setup transaction is not valid base58/base64.");
    }
    const parsed = await parseSetupTx(bytes, connection);
    if ("ok" in parsed) return parsed; // erro estruturado

    // Todos os signers exigidos precisam ser o payer (usuario assina 1x).
    const extraSigner = parsed.requiredSigners.find((s) => s !== payerKey.toBase58());
    if (extraSigner) {
      return fail("SETUP_TX_EXTRA_SIGNERS", "Setup transaction requires a signer other than the payer.");
    }

    allInstructions.push(...parsed.instructions);
    for (const lut of parsed.lookups) {
      const k = lut.key.toBase58();
      if (!lookupKeys.has(k)) {
        lookupKeys.add(k);
        allLookups.push(lut);
      }
    }
  }

  if (allInstructions.length === 0) {
    return fail("SETUP_TX_NO_INSTRUCTIONS", "Setup transactions contained no instructions.");
  }

  let blockhash: { blockhash: string; lastValidBlockHeight: number };
  try {
    blockhash = await connection.getLatestBlockhash("confirmed");
  } catch {
    return fail("SETUP_TX_BLOCKHASH_FAILED", "Could not fetch a recent blockhash for consolidation.");
  }

  try {
    const message = new TransactionMessage({
      payerKey,
      recentBlockhash: blockhash.blockhash,
      instructions: allInstructions,
    }).compileToV0Message(allLookups);
    const merged = new VersionedTransaction(message);
    const serialized = merged.serialize();
    if (serialized.length > MAX_TX_BYTES) {
      return fail(
        "SETUP_TX_TOO_LARGE",
        `Consolidated setup transaction exceeds ${MAX_TX_BYTES} bytes (${serialized.length}).`,
      );
    }
    return {
      ok: true,
      transaction: bs58.encode(serialized),
      encoding: "base58",
      blockhash,
      mergedCount: setupTxs.length,
    };
  } catch {
    return fail("SETUP_TX_COMPILE_FAILED", "Failed to compile the consolidated setup transaction.");
  }
}
