/**
 * PAID_SETUP_RECOVERY: decisão pura e determinística do recovery de config.
 *
 * Lógica isolada (sem rede/IO) usada por /api/launchpad/recover-config para
 * decidir o desfecho do recovery a partir de: verificação das assinaturas
 * on-chain (status + VÍNCULO com wallet/mint/programa), provenance do registro
 * COM ownership, configKey esperado pelo cliente (apenas consistência) e
 * resultado do recheck idempotente na Bags.
 *
 * Invariantes:
 *  - nunca propõe novo setup (newSetupRequired é sempre false);
 *  - nunca retorna transações para assinatura;
 *  - mismatch de configKey sempre bloqueia (CONFIG_KEY_MISMATCH);
 *  - RECOVERY_OWNERSHIP_GATE: provenance de outra wallet bloqueia
 *    (RECOVERY_OWNERSHIP_MISMATCH) e nunca é fonte de chave;
 *  - VERIFIED_SETUP_SIGNATURE_GATE: status "confirmed" sozinho não basta —
 *    assinaturas sem vínculo provado bloqueiam com código específico;
 *  - UNTRUSTED_CLIENT_CONFIG_KEY: expectedConfigKey é dica/consistência,
 *    NUNCA fonte autoritativa de config_ready;
 *  - configReady só é true com setup confirmado E configKey de fonte
 *    autoritativa (registry_owned | bags_recheck_verified | transaction_verified).
 */

import type { SetupVerificationCode } from "./recovery-transaction-verifier";

export type RecoverySignatureStatus = "confirmed" | "pending" | "failed" | "not_found";

export interface RecoverySignatureState {
  signature: string;
  status: RecoverySignatureStatus;
  /** Código de falha do vínculo (verifier); ausente quando vínculo provado. */
  verificationCode?: SetupVerificationCode;
}

export interface RecoveryRecheckInput {
  /** false quando a chamada upstream falhou (rede/4xx/5xx). */
  ok: boolean;
  upstreamStatus?: number | null;
  upstreamMessage?: string | null;
  /** Campos extraídos do FeeShareConfigV2Response normalizado. */
  needsCreation?: boolean | null;
  hasSetupTransactions?: boolean;
  configKey?: string | null;
}

export type RegistryOwnership = "owned" | "other_wallet" | "none" | "unavailable";

export interface RecoveryDecisionInput {
  signatureStates: RecoverySignatureState[];
  /** RECOVERY_OWNERSHIP_GATE: resultado do lookup mint+wallet no registro. */
  registryOwnership: RegistryOwnership;
  /** Chave do registro — só é considerada quando registryOwnership === "owned". */
  registryConfigKey?: string | null;
  /** UNTRUSTED_CLIENT_CONFIG_KEY: dica do cliente; nunca fonte autoritativa. */
  expectedConfigKey?: string | null;
  /** null = recheck ainda não executado (resolvido antes via registro). */
  recheck?: RecoveryRecheckInput | null;
}

export type RecoveryReadySource = "registry_owned" | "bags_recheck_verified" | "transaction_verified";

export type RecoveryBlockCode =
  | "CONFIG_RECOVERY_UNRESOLVED"
  | "CONFIG_RECOVERY_PENDING"
  | "CONFIG_KEY_MISMATCH"
  | "BAGS_CONFIG_NOT_READY"
  | "RECOVERY_OWNERSHIP_MISMATCH"
  | SetupVerificationCode;

export type RecoveryOutcome =
  | {
      outcome: "ready";
      state: "config_ready";
      configKey: string;
      source: RecoveryReadySource;
      allSetupConfirmed: true;
      configReady: true;
      newSetupRequired: false;
    }
  | {
      outcome: "blocked";
      state: "recovery_blocked" | "setup_confirming";
      code: RecoveryBlockCode;
      allSetupConfirmed: boolean;
      configReady: false;
      retrySafe: boolean;
      newSetupRequired: false;
    };

const blocked = (
  code: RecoveryBlockCode,
  options: { state?: "recovery_blocked" | "setup_confirming"; allSetupConfirmed: boolean; retrySafe: boolean },
): RecoveryOutcome => ({
  outcome: "blocked",
  state: options.state || "recovery_blocked",
  code,
  allSetupConfirmed: options.allSetupConfirmed,
  configReady: false,
  retrySafe: options.retrySafe,
  newSetupRequired: false,
});

export function decideConfigRecovery(input: RecoveryDecisionInput): RecoveryOutcome {
  const { signatureStates, registryOwnership, expectedConfigKey } = input;

  const anyFailed = signatureStates.some((s) => s.status === "failed");
  const allConfirmed =
    signatureStates.length > 0 && signatureStates.every((s) => s.status === "confirmed");

  // 1. Assinatura falhada on-chain: recovery automático recusado.
  if (anyFailed) {
    return blocked("SETUP_SIGNATURE_FAILED", { allSetupConfirmed: false, retrySafe: false });
  }

  // 2. Assinatura não encontrada: bloqueio explícito (pode ser RPC atrasado).
  if (signatureStates.some((s) => s.status === "not_found")) {
    return blocked("SETUP_SIGNATURE_NOT_FOUND", { allSetupConfirmed: false, retrySafe: true });
  }

  // 3. Setup ainda não totalmente confirmado: aguardar (retry seguro).
  if (!allConfirmed) {
    return blocked("CONFIG_RECOVERY_PENDING", {
      state: "setup_confirming",
      allSetupConfirmed: false,
      retrySafe: true,
    });
  }

  // 4. VERIFIED_SETUP_SIGNATURE_GATE: toda assinatura confirmada também
  //    precisa ter o vínculo provado (wallet signer + mint + programa).
  const verificationFailure = signatureStates.find((s) => s.verificationCode);
  if (verificationFailure?.verificationCode) {
    const code = verificationFailure.verificationCode;
    // UNVERIFIABLE/NOT_FOUND podem melhorar com retry (RPC/lookup); mismatch
    // de wallet/mint e programa não reconhecido são bloqueio duro.
    const retrySafe = code === "SETUP_TRANSACTION_UNVERIFIABLE" || code === "SETUP_SIGNATURE_NOT_FOUND";
    return blocked(code, { allSetupConfirmed: true, retrySafe });
  }

  // 5. RECOVERY_OWNERSHIP_GATE: provenance do mint pertencente a outra wallet.
  if (registryOwnership === "other_wallet") {
    return blocked("RECOVERY_OWNERSHIP_MISMATCH", { allSetupConfirmed: true, retrySafe: false });
  }

  const registryConfigKey = registryOwnership === "owned" ? input.registryConfigKey || null : null;

  // 6. Mismatch entre chave local e registro (owned): bloqueio duro.
  if (expectedConfigKey && registryConfigKey && expectedConfigKey !== registryConfigKey) {
    return blocked("CONFIG_KEY_MISMATCH", { allSetupConfirmed: true, retrySafe: false });
  }

  // 7. Registro próprio resolve direto (fonte autoritativa preferida).
  if (registryConfigKey) {
    return {
      outcome: "ready",
      state: "config_ready",
      configKey: registryConfigKey,
      source: "registry_owned",
      allSetupConfirmed: true,
      configReady: true,
      newSetupRequired: false,
    };
  }

  const recheck = input.recheck;

  // 8. Sem fonte autoritativa e sem recheck executável: pendente.
  if (!recheck || !recheck.ok) {
    return blocked("CONFIG_RECOVERY_PENDING", { allSetupConfirmed: true, retrySafe: true });
  }

  // 9. Bags ainda exige criação/retorna setup txs: confirmado on-chain porém
  //    não indexado — nunca repassar transações; aguardar.
  if (recheck.needsCreation === true || recheck.hasSetupTransactions) {
    return blocked("BAGS_CONFIG_NOT_READY", { allSetupConfirmed: true, retrySafe: true });
  }

  const recheckedKey = recheck.configKey || null;

  // 10. Recheck devolveu chave: fonte autoritativa, validando consistência
  //     com a dica do cliente (mismatch bloqueia).
  if (recheckedKey) {
    if (expectedConfigKey && recheckedKey !== expectedConfigKey) {
      return blocked("CONFIG_KEY_MISMATCH", { allSetupConfirmed: true, retrySafe: false });
    }
    return {
      outcome: "ready",
      state: "config_ready",
      configKey: recheckedKey,
      source: "bags_recheck_verified",
      allSetupConfirmed: true,
      configReady: true,
      newSetupRequired: false,
    };
  }

  // 11. UNTRUSTED_CLIENT_CONFIG_KEY: config existe (needsCreation false, sem
  //     txs) mas NENHUMA fonte autoritativa tem a chave. A chave enviada pelo
  //     cliente NÃO basta para liberar config_ready — irresolvido.
  return blocked("CONFIG_RECOVERY_UNRESOLVED", { allSetupConfirmed: true, retrySafe: true });
}
