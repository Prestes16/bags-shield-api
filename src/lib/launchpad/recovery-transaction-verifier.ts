/**
 * VERIFIED_SETUP_SIGNATURE_GATE: confirmed status alone is not sufficient
 *
 * Verificação pura (sem rede) do VÍNCULO entre uma assinatura de setup e o
 * recovery solicitado. Uma assinatura Solana confirmada qualquer NÃO libera
 * recovery — é obrigatório provar, por transação:
 *  - a wallet solicitante é signer;
 *  - o baseMint é referenciado pela transação;
 *  - ao menos um programa do fluxo fee-share/launch da Bags é invocado.
 *
 * Program IDs oficiais (fonte: https://docs.bags.fm/principles/program-ids —
 * mainnet-beta; NÃO inventar IDs):
 *  - Bags Fee Share V1 (legacy)  FEEhPbKVKnco9EXnaY3i4R5rQVUx91wgVfu8qokixywi
 *  - Bags Fee Share V2 (atual)   FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK
 *  - Meteora DBC                 dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
 *  - Meteora DAMM v2             cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG
 *
 * Falha FECHADO: quando a inspeção não consegue provar o vínculo (ex.: lookup
 * tables não resolvidas), o resultado é não-verificável e o recovery bloqueia.
 */

export const BAGS_FEE_SHARE_V1_PROGRAM_ID = "FEEhPbKVKnco9EXnaY3i4R5rQVUx91wgVfu8qokixywi";
export const BAGS_FEE_SHARE_V2_PROGRAM_ID = "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK";
export const METEORA_DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
export const METEORA_DAMM_V2_PROGRAM_ID = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";

export const RECOGNIZED_FEE_SHARE_SETUP_PROGRAM_IDS: ReadonlySet<string> = new Set([
  BAGS_FEE_SHARE_V1_PROGRAM_ID,
  BAGS_FEE_SHARE_V2_PROGRAM_ID,
  METEORA_DBC_PROGRAM_ID,
  METEORA_DAMM_V2_PROGRAM_ID,
]);

export type SetupVerificationCode =
  | "SETUP_SIGNATURE_NOT_FOUND"
  | "SETUP_SIGNATURE_FAILED"
  | "SETUP_SIGNATURE_WALLET_MISMATCH"
  | "SETUP_SIGNATURE_MINT_MISMATCH"
  | "SETUP_TRANSACTION_UNVERIFIABLE"
  | "SETUP_TRANSACTION_NOT_RECOGNIZED";

export interface SetupTransactionFacts {
  signature: string;
  /** Chaves que assinaram a transação (prefixo numRequiredSignatures). */
  signerKeys: string[];
  /** Todas as account keys (estáticas + resolvidas via lookup quando possível). */
  accountKeys: string[];
  /** Program IDs invocados (top-level + inner instructions). */
  programIds: string[];
  /** false quando havia lookup tables que não puderam ser resolvidas. */
  lookupsResolved: boolean;
}

export interface SetupSignatureVerification {
  signature: string;
  valid: boolean;
  walletIsSigner: boolean;
  baseMintReferenced: boolean;
  recognizedProgram: boolean;
  code?: SetupVerificationCode;
  reason?: string;
}

/**
 * Decide o vínculo de UMA transação de setup com (wallet, baseMint).
 * Puro e determinístico — testável sem RPC.
 */
export function verifySetupTransactionFacts(input: {
  wallet: string;
  baseMint: string;
  facts: SetupTransactionFacts;
}): SetupSignatureVerification {
  const { wallet, baseMint, facts } = input;

  const walletIsSigner = facts.signerKeys.includes(wallet);
  const recognizedProgram = facts.programIds.some((id) =>
    RECOGNIZED_FEE_SHARE_SETUP_PROGRAM_IDS.has(id),
  );
  const baseMintReferenced = facts.accountKeys.includes(baseMint);

  if (!walletIsSigner) {
    return {
      signature: facts.signature,
      valid: false,
      walletIsSigner,
      baseMintReferenced,
      recognizedProgram,
      code: "SETUP_SIGNATURE_WALLET_MISMATCH",
      reason: "Requesting wallet is not a signer of this setup transaction.",
    };
  }

  if (!recognizedProgram) {
    return {
      signature: facts.signature,
      valid: false,
      walletIsSigner,
      baseMintReferenced,
      recognizedProgram,
      code: "SETUP_TRANSACTION_NOT_RECOGNIZED",
      reason: "Transaction does not invoke any recognized Bags fee-share/launch program.",
    };
  }

  if (!baseMintReferenced) {
    // Fail closed: sem o mint nas contas visíveis, só bloqueia. Se havia
    // lookup tables não resolvidas, o vínculo é "não verificável" (e não
    // necessariamente um mismatch).
    if (!facts.lookupsResolved) {
      return {
        signature: facts.signature,
        valid: false,
        walletIsSigner,
        baseMintReferenced,
        recognizedProgram,
        code: "SETUP_TRANSACTION_UNVERIFIABLE",
        reason: "Address lookup tables could not be resolved; baseMint linkage cannot be proven.",
      };
    }
    return {
      signature: facts.signature,
      valid: false,
      walletIsSigner,
      baseMintReferenced,
      recognizedProgram,
      code: "SETUP_SIGNATURE_MINT_MISMATCH",
      reason: "Setup transaction does not reference the provided baseMint.",
    };
  }

  return {
    signature: facts.signature,
    valid: true,
    walletIsSigner,
    baseMintReferenced,
    recognizedProgram,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Extração de fatos a partir do retorno de getTransaction (web3.js), com
 * suporte a versioned transactions e address lookup tables. Transforma dados
 * já carregados — não faz rede — e portanto também é testável.
 * ──────────────────────────────────────────────────────────────────────────── */

function keyToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as { toBase58?: () => string; toString?: () => string };
  if (typeof candidate.toBase58 === "function") return candidate.toBase58();
  if (typeof candidate.toString === "function") return candidate.toString();
  return null;
}

export function extractSetupTransactionFacts(
  signature: string,
  transaction: unknown,
): SetupTransactionFacts {
  const tx = transaction as {
    transaction?: {
      message?: {
        header?: { numRequiredSignatures?: number };
        staticAccountKeys?: unknown[];
        accountKeys?: unknown[];
        addressTableLookups?: unknown[];
        compiledInstructions?: Array<{ programIdIndex?: number }>;
        instructions?: Array<{ programIdIndex?: number; programId?: unknown }>;
        getAccountKeys?: (args?: unknown) => { length: number; get: (index: number) => unknown };
      };
    };
    meta?: {
      loadedAddresses?: { writable?: unknown[]; readonly?: unknown[] } | null;
      innerInstructions?: Array<{ instructions?: Array<{ programIdIndex?: number; programId?: unknown }> }>;
    } | null;
  };

  const message = tx.transaction?.message;
  const staticKeys = (
    Array.isArray(message?.staticAccountKeys)
      ? message.staticAccountKeys
      : Array.isArray(message?.accountKeys)
        ? message.accountKeys
        : []
  )
    .map(keyToString)
    .filter((key): key is string => Boolean(key));

  const numRequiredSignatures = message?.header?.numRequiredSignatures ?? 0;
  const signerKeys = staticKeys.slice(0, Math.max(0, numRequiredSignatures));

  const lookups = Array.isArray(message?.addressTableLookups) ? message.addressTableLookups : [];
  const loaded = tx.meta?.loadedAddresses;
  const loadedKeys = [
    ...(Array.isArray(loaded?.writable) ? loaded.writable : []),
    ...(Array.isArray(loaded?.readonly) ? loaded.readonly : []),
  ]
    .map(keyToString)
    .filter((key): key is string => Boolean(key));

  // Lookup tables presentes mas meta.loadedAddresses ausente => não resolvidas.
  const lookupsResolved = lookups.length === 0 || loadedKeys.length > 0;

  const accountKeys = [...staticKeys, ...loadedKeys];

  const programIds = new Set<string>();
  const addInstruction = (instruction: { programIdIndex?: number; programId?: unknown } | undefined) => {
    if (!instruction) return;
    const direct = keyToString(instruction.programId);
    if (direct) {
      programIds.add(direct);
      return;
    }
    if (typeof instruction.programIdIndex === "number") {
      const key = accountKeys[instruction.programIdIndex];
      if (key) programIds.add(key);
    }
  };

  for (const instruction of message?.compiledInstructions ?? message?.instructions ?? []) {
    addInstruction(instruction);
  }
  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const instruction of group.instructions ?? []) addInstruction(instruction);
  }

  return {
    signature,
    signerKeys,
    accountKeys,
    programIds: Array.from(programIds),
    lookupsResolved,
  };
}
