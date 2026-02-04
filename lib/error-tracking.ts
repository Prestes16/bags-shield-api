/**
 * Sistema centralizado de rastreamento de erros
 * Captura e registra erros de todas as fontes, incluindo Helius API
 */

export interface ErrorContext {
  requestId?: string;
  endpoint?: string;
  method?: string;
  source?: string; // 'helius' | 'bags' | 'internal' | 'scan' | 'simulate' | 'apply' | 'webhook'
  userId?: string;
  wallet?: string;
  network?: string;
  metadata?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  timestamp: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
    name?: string;
  };
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private maxErrors = 1000; // Limite de erros em memória

  /**
   * Rastreia um erro com contexto completo
   */
  trackError(
    error: Error | string | unknown,
    context: ErrorContext,
    severity: TrackedError['severity'] = 'medium',
  ): string {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : undefined;

    const trackedError: TrackedError = {
      id: errorId,
      timestamp: new Date().toISOString(),
      error: {
        message: errorMessage,
        code: this.extractErrorCode(error),
        stack: errorStack,
        name: errorName,
      },
      context: {
        ...context,
        requestId: context.requestId || `req_${Date.now()}`,
      },
      severity,
      resolved: false,
    };

    // Adiciona ao array (com limite)
    if (this.errors.length >= this.maxErrors) {
      this.errors.shift(); // Remove o mais antigo
    }
    this.errors.push(trackedError);

    // Log no console com contexto estruturado
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    console[logLevel](`[ErrorTracker] ${errorId}`, {
      message: errorMessage,
      source: context.source,
      endpoint: context.endpoint,
      requestId: trackedError.context.requestId,
      severity,
      metadata: context.metadata,
    });

    // Se for erro crítico ou da Helius, log adicional
    if (severity === 'critical' || context.source === 'helius') {
      console.error(`[ErrorTracker:${context.source}]`, {
        errorId,
        error: errorMessage,
        stack: errorStack,
        context: trackedError.context,
      });
    }

    return errorId;
  }

  /**
   * Extrai código de erro quando disponível
   */
  private extractErrorCode(error: unknown): string | undefined {
    if (error instanceof Error) {
      // Tenta extrair código de propriedades comuns
      const err = error as any;
      return err.code || err.statusCode || err.errorCode || undefined;
    }
    return undefined;
  }

  /**
   * Rastreia erro específico da Helius API
   */
  trackHeliusError(
    error: Error | string | unknown,
    context: Omit<ErrorContext, 'source'>,
    severity: TrackedError['severity'] = 'high',
  ): string {
    return this.trackError(
      error,
      {
        ...context,
        source: 'helius',
      },
      severity,
    );
  }

  /**
   * Rastreia erro específico da Jupiter API
   */
  trackJupiterError(
    error: Error | string | unknown,
    context: Omit<ErrorContext, 'source'>,
    severity: TrackedError['severity'] = 'high',
  ): string {
    return this.trackError(
      error,
      {
        ...context,
        source: 'jupiter',
      },
      severity,
    );
  }

  /**
   * Obtém todos os erros rastreados
   */
  getErrors(filter?: {
    source?: string;
    severity?: TrackedError['severity'];
    resolved?: boolean;
    since?: Date;
  }): TrackedError[] {
    let filtered = [...this.errors];

    if (filter?.source) {
      filtered = filtered.filter((e) => e.context.source === filter.source);
    }

    if (filter?.severity) {
      filtered = filtered.filter((e) => e.severity === filter.severity);
    }

    if (filter?.resolved !== undefined) {
      filtered = filtered.filter((e) => e.resolved === filter.resolved);
    }

    if (filter?.since) {
      const sinceTime = filter.since.getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
    }

    return filtered;
  }

  /**
   * Obtém erros da Helius especificamente
   */
  getHeliusErrors(includeResolved = false): TrackedError[] {
    return this.getErrors({
      source: 'helius',
      resolved: includeResolved ? undefined : false,
    });
  }

  /**
   * Obtém erros da Jupiter especificamente
   */
  getJupiterErrors(includeResolved = false): TrackedError[] {
    return this.getErrors({
      source: 'jupiter',
      resolved: includeResolved ? undefined : false,
    });
  }

  /**
   * Marca um erro como resolvido
   */
  markResolved(errorId: string): boolean {
    const error = this.errors.find((e) => e.id === errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Obtém estatísticas de erros
   */
  getStats(): {
    total: number;
    bySource: Record<string, number>;
    bySeverity: Record<string, number>;
    unresolved: number;
    heliusErrors: number;
    jupiterErrors: number;
  } {
    const stats = {
      total: this.errors.length,
      bySource: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      unresolved: 0,
      heliusErrors: 0,
      jupiterErrors: 0,
    };

    this.errors.forEach((error) => {
      // Por fonte
      const source = error.context.source || 'unknown';
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;

      // Por severidade
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;

      // Não resolvidos
      if (!error.resolved) {
        stats.unresolved++;
      }

      // Erros da Helius
      if (error.context.source === 'helius') {
        stats.heliusErrors++;
      }

      // Erros da Jupiter
      if (error.context.source === 'jupiter') {
        stats.jupiterErrors = (stats.jupiterErrors || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Limpa erros antigos (mais de X horas)
   */
  cleanup(olderThanHours = 24): number {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialLength = this.errors.length;
    this.errors = this.errors.filter((e) => new Date(e.timestamp) > cutoff);
    return initialLength - this.errors.length;
  }
}

// Instância singleton
export const errorTracker = new ErrorTracker();

/**
 * Helper para rastrear erros em handlers de API
 */
export function trackApiError(error: Error | string | unknown, req: any, context: Partial<ErrorContext> = {}): string {
  const endpoint = req.url || context.endpoint || 'unknown';
  const method = req.method || context.method || 'unknown';
  const requestId = req.headers?.['x-request-id'] || context.requestId;

  return errorTracker.trackError(error, {
    ...context,
    endpoint,
    method,
    requestId,
  });
}

/**
 * Helper específico para erros da Helius
 */
export function trackHeliusApiError(
  error: Error | string | unknown,
  req: any,
  context: Partial<ErrorContext> = {},
): string {
  const endpoint = req.url || context.endpoint || 'unknown';
  const method = req.method || context.method || 'unknown';
  const requestId = req.headers?.['x-request-id'] || context.requestId;

  return errorTracker.trackHeliusError(error, {
    ...context,
    endpoint,
    method,
    requestId,
  });
}

/**
 * Helper específico para erros da Jupiter
 */
export function trackJupiterApiError(
  error: Error | string | unknown,
  req: any,
  context: Partial<ErrorContext> = {},
): string {
  const endpoint = req.url || context.endpoint || 'unknown';
  const method = req.method || context.method || 'unknown';
  const requestId = req.headers?.['x-request-id'] || context.requestId;

  return errorTracker.trackJupiterError(error, {
    ...context,
    endpoint,
    method,
    requestId,
  });
}
