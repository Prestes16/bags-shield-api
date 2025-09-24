// --- SUBSTITUIR APENAS O SCHEMA NO api/_utils.js ---
import { z } from 'zod';

export const ScanInputSchema = z.object({
  mint: z.string().min(32).max(64).optional(),
  tokenMint: z.string().min(32).max(64).optional(),
  transactionSig: z.string().min(20).max(120).optional(),
  network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  context: z.object({
    wallet: z.string().optional(),
    appId: z.string().optional(),
  }).optional()
})
.transform((data) => {
  // alias: se vier tokenMint, use como mint
  return {
    ...data,
    mint: data.mint ?? data.tokenMint ?? undefined
  };
})
.refine((data) => data.mint || data.transactionSig, {
  message: 'Forneça mint/tokenMint ou transactionSig.'
});
