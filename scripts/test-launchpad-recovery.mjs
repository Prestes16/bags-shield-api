#!/usr/bin/env node
/**
 * PAID_SETUP_RECOVERY tests — decisão pura do recovery de config + verifier
 * de vínculo das assinaturas + guards de ownership/persistência.
 *
 * Roda em Node >= 22.6 (usa --experimental-strip-types para importar o TS
 * diretamente; o script se relança com a flag automaticamente).
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.__STRIP_TYPES_CHILD) {
  const self = fileURLToPath(import.meta.url);
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", self],
    { stdio: "inherit", env: { ...process.env, __STRIP_TYPES_CHILD: "1" } },
  );
  process.exit(result.status ?? 1);
}

const { decideConfigRecovery } = await import("../src/lib/launchpad/recovery-decision.ts");
const {
  verifySetupTransactionFacts,
  extractSetupTransactionFacts,
  BAGS_FEE_SHARE_V2_PROGRAM_ID,
} = await import("../src/lib/launchpad/recovery-transaction-verifier.ts");
const { upsertOwnedLaunchProvenance } = await import("../src/lib/launchpad/launch-registry.ts");

let run = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  run += 1;
  try {
    const maybe = fn();
    if (maybe && typeof maybe.then === "function") {
      return maybe.then(
        () => { passed += 1; console.log(`✓ ${name}`); },
        (error) => { failed += 1; console.error(`✗ ${name}\n  ${error.message}`); },
      );
    }
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
  return Promise.resolve();
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

const SIG = "5".repeat(87);
const KEY_A = "ConfigKeyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const KEY_B = "ConfigKeyBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const WALLET = "WalletWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW";
const OTHER = "WalletXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const MINT = "MintMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM";

const confirmed = [{ signature: SIG, status: "confirmed" }];
const pending = [{ signature: SIG, status: "pending" }];
const failedSig = [{ signature: SIG, status: "failed" }];
const base = { registryOwnership: "none" };

/* ───────────────────────── decisão: cenários originais (adaptados) ───────── */

await test("setup pendente => CONFIG_RECOVERY_PENDING (setup_confirming, retrySafe)", () => {
  const d = decideConfigRecovery({ ...base, signatureStates: pending, recheck: null });
  assert(d.outcome === "blocked" && d.code === "CONFIG_RECOVERY_PENDING", `code: ${d.code}`);
  assert(d.state === "setup_confirming", `state: ${d.state}`);
  assert(d.retrySafe === true && d.newSetupRequired === false, "flags");
});

await test("setup confirmado + registry OWNED => config_ready (source registry_owned)", () => {
  const d = decideConfigRecovery({
    signatureStates: confirmed,
    registryOwnership: "owned",
    registryConfigKey: KEY_A,
    expectedConfigKey: KEY_A,
    recheck: null,
  });
  assert(d.outcome === "ready" && d.configKey === KEY_A, "deveria estar pronto com KEY_A");
  assert(d.source === "registry_owned", `source: ${d.source}`);
});

await test("Bags não pronta (setup txs no recheck) => BAGS_CONFIG_NOT_READY", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: confirmed,
    recheck: { ok: true, needsCreation: true, hasSetupTransactions: true, configKey: null },
  });
  assert(d.outcome === "blocked" && d.code === "BAGS_CONFIG_NOT_READY", `code: ${d.code}`);
  assert(d.retrySafe === true && d.newSetupRequired === false, "flags");
});

await test("recheck upstream 502 => CONFIG_RECOVERY_PENDING (retrySafe)", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: confirmed,
    recheck: { ok: false, upstreamStatus: 502 },
  });
  assert(d.outcome === "blocked" && d.code === "CONFIG_RECOVERY_PENDING", `code: ${d.code}`);
  assert(d.retrySafe === true, "retrySafe");
});

await test("config existe sem chave e sem expected => CONFIG_RECOVERY_UNRESOLVED", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: confirmed,
    recheck: { ok: true, needsCreation: false, hasSetupTransactions: false, configKey: null },
  });
  assert(d.outcome === "blocked" && d.code === "CONFIG_RECOVERY_UNRESOLVED", `code: ${d.code}`);
});

await test("UNTRUSTED_CLIENT_CONFIG_KEY: expected forjado sem fonte autoritativa => NÃO fica ready", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: confirmed,
    expectedConfigKey: KEY_A,
    recheck: { ok: true, needsCreation: false, hasSetupTransactions: false, configKey: null },
  });
  assert(d.outcome === "blocked", "chave do cliente nunca libera ready sozinha");
  assert(d.code === "CONFIG_RECOVERY_UNRESOLVED", `code: ${d.code}`);
  assert(d.configReady === false, "configReady deve ser false");
});

await test("mismatch registry(owned) vs expected => CONFIG_KEY_MISMATCH (retrySafe false)", () => {
  const d = decideConfigRecovery({
    signatureStates: confirmed,
    registryOwnership: "owned",
    registryConfigKey: KEY_A,
    expectedConfigKey: KEY_B,
    recheck: null,
  });
  assert(d.outcome === "blocked" && d.code === "CONFIG_KEY_MISMATCH", `code: ${d.code}`);
  assert(d.retrySafe === false, "mismatch não é retry-safe");
});

await test("mismatch recheck vs expected => CONFIG_KEY_MISMATCH", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: confirmed,
    expectedConfigKey: KEY_B,
    recheck: { ok: true, needsCreation: false, hasSetupTransactions: false, configKey: KEY_A },
  });
  assert(d.outcome === "blocked" && d.code === "CONFIG_KEY_MISMATCH", `code: ${d.code}`);
});

await test("assinatura failed on-chain => SETUP_SIGNATURE_FAILED (retrySafe false)", () => {
  const d = decideConfigRecovery({ ...base, signatureStates: failedSig, recheck: null });
  assert(d.outcome === "blocked" && d.code === "SETUP_SIGNATURE_FAILED", `code: ${d.code}`);
  assert(d.retrySafe === false, "assinatura falhada não é retry-safe");
});

await test("recheck devolve chave consistente => ready (bags_recheck_verified)", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: confirmed,
    expectedConfigKey: KEY_A,
    recheck: { ok: true, needsCreation: false, hasSetupTransactions: false, configKey: KEY_A },
  });
  assert(d.outcome === "ready" && d.source === "bags_recheck_verified", `source: ${d.source}`);
});

/* ───────────────────────── ownership gate ────────────────────────────────── */

await test("RECOVERY_OWNERSHIP_GATE: mint correto + wallet errada => RECOVERY_OWNERSHIP_MISMATCH", () => {
  const d = decideConfigRecovery({
    signatureStates: confirmed,
    registryOwnership: "other_wallet",
    registryConfigKey: null,
    expectedConfigKey: KEY_A,
    recheck: null,
  });
  assert(d.outcome === "blocked" && d.code === "RECOVERY_OWNERSHIP_MISMATCH", `code: ${d.code}`);
  assert(d.retrySafe === false && d.newSetupRequired === false, "flags");
});

await test("ownership other_wallet NUNCA usa chave do registro como fonte", () => {
  const d = decideConfigRecovery({
    signatureStates: confirmed,
    registryOwnership: "other_wallet",
    registryConfigKey: KEY_A, // chave existe, mas pertence a outra wallet
    recheck: null,
  });
  assert(d.outcome === "blocked", "não pode ficar ready com provenance alheia");
});

/* ───────────────────────── vínculo das assinaturas (verifier) ───────────── */

const factsBase = {
  signature: SIG,
  signerKeys: [WALLET],
  accountKeys: [WALLET, MINT, BAGS_FEE_SHARE_V2_PROGRAM_ID],
  programIds: [BAGS_FEE_SHARE_V2_PROGRAM_ID],
  lookupsResolved: true,
};

await test("verifier: transação vinculada (signer+mint+programa) => valid", () => {
  const v = verifySetupTransactionFacts({ wallet: WALLET, baseMint: MINT, facts: factsBase });
  assert(v.valid === true && v.walletIsSigner && v.baseMintReferenced && v.recognizedProgram, "deveria validar");
});

await test("verifier: wallet não é signer => SETUP_SIGNATURE_WALLET_MISMATCH", () => {
  const v = verifySetupTransactionFacts({
    wallet: WALLET,
    baseMint: MINT,
    facts: { ...factsBase, signerKeys: [OTHER] },
  });
  assert(v.valid === false && v.code === "SETUP_SIGNATURE_WALLET_MISMATCH", `code: ${v.code}`);
});

await test("verifier: assinatura confirmada arbitrária (programa desconhecido) => SETUP_TRANSACTION_NOT_RECOGNIZED", () => {
  const v = verifySetupTransactionFacts({
    wallet: WALLET,
    baseMint: MINT,
    facts: { ...factsBase, programIds: ["11111111111111111111111111111111"] },
  });
  assert(v.valid === false && v.code === "SETUP_TRANSACTION_NOT_RECOGNIZED", `code: ${v.code}`);
});

await test("verifier: sem referência ao baseMint => SETUP_SIGNATURE_MINT_MISMATCH", () => {
  const v = verifySetupTransactionFacts({
    wallet: WALLET,
    baseMint: MINT,
    facts: { ...factsBase, accountKeys: [WALLET, BAGS_FEE_SHARE_V2_PROGRAM_ID] },
  });
  assert(v.valid === false && v.code === "SETUP_SIGNATURE_MINT_MISMATCH", `code: ${v.code}`);
});

await test("verifier: lookups não resolvidos sem mint visível => SETUP_TRANSACTION_UNVERIFIABLE (fail closed)", () => {
  const v = verifySetupTransactionFacts({
    wallet: WALLET,
    baseMint: MINT,
    facts: { ...factsBase, accountKeys: [WALLET], lookupsResolved: false },
  });
  assert(v.valid === false && v.code === "SETUP_TRANSACTION_UNVERIFIABLE", `code: ${v.code}`);
});

await test("verifier: extractSetupTransactionFacts (versioned + loadedAddresses)", () => {
  const fakeTx = {
    transaction: {
      message: {
        header: { numRequiredSignatures: 1 },
        staticAccountKeys: [WALLET, BAGS_FEE_SHARE_V2_PROGRAM_ID],
        addressTableLookups: [{}],
        compiledInstructions: [{ programIdIndex: 1 }],
      },
    },
    meta: { loadedAddresses: { writable: [MINT], readonly: [] }, innerInstructions: [] },
  };
  const facts = extractSetupTransactionFacts(SIG, fakeTx);
  assert(facts.signerKeys.length === 1 && facts.signerKeys[0] === WALLET, "signer extraído errado");
  assert(facts.accountKeys.includes(MINT), "mint via lookup não extraído");
  assert(facts.programIds.includes(BAGS_FEE_SHARE_V2_PROGRAM_ID), "programa não extraído");
  assert(facts.lookupsResolved === true, "lookups deveriam constar como resolvidos");
});

await test("decisão: assinatura confirmada porém sem vínculo => bloqueia com código do verifier", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: [{ signature: SIG, status: "confirmed", verificationCode: "SETUP_SIGNATURE_WALLET_MISMATCH" }],
    registryConfigKey: KEY_A,
    recheck: null,
  });
  assert(d.outcome === "blocked" && d.code === "SETUP_SIGNATURE_WALLET_MISMATCH", `code: ${d.code}`);
  assert(d.retrySafe === false, "wallet mismatch é bloqueio duro");
});

await test("decisão: vínculo não verificável => bloqueia retry-safe", () => {
  const d = decideConfigRecovery({
    ...base,
    signatureStates: [{ signature: SIG, status: "confirmed", verificationCode: "SETUP_TRANSACTION_UNVERIFIABLE" }],
    recheck: null,
  });
  assert(d.outcome === "blocked" && d.code === "SETUP_TRANSACTION_UNVERIFIABLE", `code: ${d.code}`);
  assert(d.retrySafe === true, "unverifiable pode melhorar com retry");
});

/* ───────────────────────── persistência ──────────────────────────────────── */

await test("DURABLE_PROVENANCE: upsert sem Supabase configurado => persisted:false (create-config bloquearia setup pago)", async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const result = await upsertOwnedLaunchProvenance({
      mint: MINT,
      requestingWallet: WALLET,
      creatorWallet: WALLET,
      launchWallet: WALLET,
      configKey: KEY_A,
      launchStatus: "config_created",
    });
    assert(result.persisted === false, "sem registro durável não pode reportar persisted:true");
    assert(result.conflict === false, "ausência de registro não é conflito");
  } finally {
    if (prevUrl) process.env.SUPABASE_URL = prevUrl;
    if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    if (prevAnon) process.env.SUPABASE_ANON_KEY = prevAnon;
  }
});

/* ───────────────────────── invariantes globais ───────────────────────────── */

const allScenarios = [
  { ...base, signatureStates: pending, recheck: null },
  { ...base, signatureStates: failedSig, recheck: null },
  { signatureStates: confirmed, registryOwnership: "owned", registryConfigKey: KEY_A, recheck: null },
  { signatureStates: confirmed, registryOwnership: "other_wallet", registryConfigKey: KEY_A, recheck: null },
  { ...base, signatureStates: confirmed, recheck: { ok: false } },
  { ...base, signatureStates: confirmed, recheck: { ok: true, needsCreation: true, hasSetupTransactions: true } },
  { ...base, signatureStates: confirmed, expectedConfigKey: KEY_A, recheck: { ok: true, needsCreation: false, hasSetupTransactions: false, configKey: null } },
  { ...base, signatureStates: confirmed, recheck: { ok: true, needsCreation: false, hasSetupTransactions: false, configKey: KEY_A } },
  { ...base, signatureStates: [{ signature: SIG, status: "confirmed", verificationCode: "SETUP_SIGNATURE_MINT_MISMATCH" }], recheck: null },
];

await test("invariantes: newSetupRequired sempre false; ready sempre com configKey de fonte autoritativa", () => {
  for (const scenario of allScenarios) {
    const d = decideConfigRecovery(scenario);
    assert(d.newSetupRequired === false, "newSetupRequired deve ser sempre false");
    if (d.outcome === "ready") {
      assert(typeof d.configKey === "string" && d.configKey.length > 0, "ready sem configKey");
      assert(["registry_owned", "bags_recheck_verified", "transaction_verified"].includes(d.source), `source inválida: ${d.source}`);
      assert(d.configReady === true, "ready sem configReady");
    } else {
      assert(d.configReady === false, "blocked com configReady true");
    }
  }
});

await test("invariantes: nenhum desfecho contém transações/payload assinável", () => {
  for (const scenario of allScenarios) {
    const d = decideConfigRecovery(scenario);
    const serialized = JSON.stringify(d).toLowerCase();
    assert(!("transactions" in d), "outcome não pode ter transactions");
    assert(!("feeShareSetupTransactions" in d), "outcome não pode ter setup txs");
    assert(!serialized.includes('"transaction"'), "outcome não pode conter transação serializada");
  }
});

await test("invariantes: client_expected não existe mais como fonte", () => {
  for (const scenario of allScenarios) {
    const d = decideConfigRecovery(scenario);
    if (d.outcome === "ready") assert(d.source !== "client_expected", "client_expected proibida");
  }
});

console.log(`\n${passed}/${run} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
