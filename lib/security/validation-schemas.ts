/**
 * Zod Validation Schemas with .strict()
 *
 * Todos os schemas usam .strict() para rejeitar campos extras
 * Isso previne Parameter Pollution e garante que apenas campos
 * esperados sejam processados
 */

import { z } from 'zod';
import {
  sanitizeString,
  sanitizeSolanaAddress,
  sanitizeMintAddress,
  sanitizeTransactionSignature,
  sanitizeNumber,
} from './input-sanitization';

/**
 * Schema para scan de transação
 *
 * Validações:
 * - rawTransaction: string base64 válida
 * - network: apenas valores permitidos
 * - Campos extras são rejeitados (.strict())
 */
export const scanTransactionSchema = z
  .object({
    rawTransaction: z
      .string()
      .min(1, 'rawTransaction é obrigatório')
      .max(10000, 'rawTransaction muito grande')
      .refine(
        (val) => {
          try {
            // Valida formato base64
            const sanitized = sanitizeString(val);
            Buffer.from(sanitized, 'base64');
            return true;
          } catch {
            return false;
          }
        },
        { message: 'rawTransaction deve ser base64 válido' },
      )
      .transform((val) => sanitizeString(val)),

    network: z
      .enum(['mainnet-beta', 'devnet', 'testnet'], {
        errorMap: () => ({ message: 'network deve ser mainnet-beta, devnet ou testnet' }),
      })
      .optional()
      .default('mainnet-beta'),
  })
  .strict(); // Rejeita campos extras (Parameter Pollution prevention)

/**
 * Schema para simulação de transação
 */
export const simulateTransactionSchema = z
  .object({
    mint: z
      .string()
      .min(1, 'mint é obrigatório')
      .transform((val) => sanitizeMintAddress(val)),

    amount: z.union([z.string(), z.number()]).transform((val) => {
      const num = sanitizeNumber(val);
      if (num < 0) {
        throw new Error('amount deve ser positivo');
      }
      return num;
    }),

    network: z.enum(['mainnet-beta', 'devnet', 'testnet']).optional().default('mainnet-beta'),
  })
  .strict();

/**
 * Schema para RPC proxy requests
 *
 * Valida método RPC e parâmetros antes de repassar para Helius
 */
export const rpcProxySchema = z
  .object({
    method: z.enum(
      ['getHealth', 'getBalance', 'getSlot', 'getTransaction', 'getAccountInfo', 'simulateTransaction', 'getBlock'],
      {
        errorMap: () => ({ message: 'Método RPC não permitido' }),
      },
    ),

    params: z.array(z.unknown()).optional().default([]),

    id: z.union([z.string(), z.number()]).optional(),
  })
  .strict();

/**
 * Schema para Jupiter quote
 */
export const jupiterQuoteSchema = z
  .object({
    inputMint: z
      .string()
      .min(1)
      .transform((val) => sanitizeMintAddress(val)),

    outputMint: z
      .string()
      .min(1)
      .transform((val) => sanitizeMintAddress(val)),

    amount: z.union([z.string(), z.number()]).transform((val) => {
      const num = sanitizeNumber(val);
      if (num <= 0) {
        throw new Error('amount deve ser positivo');
      }
      return String(num);
    }),

    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(10000) // Máximo 100%
      .optional()
      .default(50),

    swapMode: z.enum(['ExactIn', 'ExactOut']).optional(),
    dexes: z.array(z.string()).optional(),
    excludeDexes: z.array(z.string()).optional(),
    asLegacyTransaction: z.boolean().optional(),
    maxAccounts: z.number().int().min(1).max(256).optional(),
  })
  .strict();

/**
 * Schema para Jupiter swap
 */
export const jupiterSwapSchema = z
  .object({
    quoteResponse: z.record(z.unknown()), // Validação mais complexa seria feita separadamente
    userPublicKey: z
      .string()
      .min(1)
      .transform((val) => sanitizeSolanaAddress(val)),

    wrapAndUnwrapSol: z.boolean().optional(),
    dynamicComputeUnitLimit: z.boolean().optional(),
    prioritizationFeeLamports: z
      .union([
        z.literal('auto'),
        z.number(),
        z.object({
          priorityLevelWithMaxLamports: z
            .object({
              maxLamports: z.number(),
              priorityLevel: z.enum(['veryLow', 'low', 'medium', 'high', 'veryHigh']),
            })
            .optional(),
        }),
      ])
      .optional(),
  })
  .strict();

/**
 * Helper para validar e sanitizar payload
 */
export async function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validação falhou: ${messages.join(', ')}`);
    }
    throw error;
  }
}
