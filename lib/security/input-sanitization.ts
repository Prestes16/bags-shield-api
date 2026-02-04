/**
 * Input Sanitization & Validation
 *
 * Implementa sanitização de inputs para prevenir:
 * - Injection attacks (SQL, NoSQL, Command)
 * - XSS (Cross-Site Scripting)
 * - Parameter Pollution
 * - Control character injection
 */

/**
 * Remove caracteres de controle invisíveis
 *
 * Caracteres removidos:
 * - NULL (0x00)
 * - Control characters (0x01-0x1F, exceto \t, \n, \r)
 * - DEL (0x7F)
 * - Unicode control characters
 *
 * Isso previne injection via caracteres invisíveis que podem
 * confundir parsers e validadores
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return (
    input
      // Remove NULL bytes (comum em injection attacks)
      .replace(/\0/g, '')
      // Remove control characters (exceto tab, newline, carriage return)
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove Unicode control characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Normaliza whitespace (previne whitespace-based attacks)
      .replace(/\s+/g, ' ')
      // Trim leading/trailing whitespace
      .trim()
  );
}

/**
 * Valida e sanitiza endereço Solana (PublicKey)
 *
 * Validações:
 * - Formato base58 válido
 * - Comprimento correto (32-44 caracteres)
 * - Apenas caracteres alfanuméricos permitidos (exceto 0, O, I, l)
 */
export function sanitizeSolanaAddress(address: string): string {
  const sanitized = sanitizeString(address);

  // Validação básica de formato Solana
  // Base58: não contém 0, O, I, l
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sanitized)) {
    throw new Error('Endereço Solana inválido');
  }

  return sanitized;
}

/**
 * Valida e sanitiza mint address (token address)
 *
 * Mesmas regras de endereço Solana
 */
export function sanitizeMintAddress(mint: string): string {
  return sanitizeSolanaAddress(mint);
}

/**
 * Valida e sanitiza transaction signature
 *
 * Formato: Base58, 88 caracteres (64 bytes em base58)
 */
export function sanitizeTransactionSignature(signature: string): string {
  const sanitized = sanitizeString(signature);

  if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(sanitized)) {
    throw new Error('Assinatura de transação inválida');
  }

  return sanitized;
}

/**
 * Valida e sanitiza número (previne overflow e NaN)
 */
export function sanitizeNumber(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Número inválido (infinito ou NaN)');
    }
    return value;
  }

  if (typeof value === 'string') {
    const sanitized = sanitizeString(value);
    const parsed = Number(sanitized);

    if (!Number.isFinite(parsed)) {
      throw new Error('Número inválido');
    }

    return parsed;
  }

  throw new Error('Valor não é um número válido');
}

/**
 * Valida e sanitiza string com tamanho máximo
 */
export function sanitizeStringWithMaxLength(input: string, maxLength: number): string {
  const sanitized = sanitizeString(input);

  if (sanitized.length > maxLength) {
    throw new Error(`String excede tamanho máximo de ${maxLength} caracteres`);
  }

  return sanitized;
}

/**
 * Remove campos extras de objeto (previne Parameter Pollution)
 *
 * Útil em conjunto com Zod .strict() para garantir que apenas
 * campos esperados sejam processados
 */
export function removeExtraFields<T extends Record<string, unknown>>(obj: T, allowedFields: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};

  for (const field of allowedFields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }

  return result;
}
