import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from './LlmProvider.ts';

export interface RetryOptions {
  /** Reintentos máximos tras el primer intento. Por defecto 3. */
  maxRetries?: number;
  /** Espera base del backoff exponencial (ms). Por defecto 2000. */
  baseDelayMs?: number;
  /** Espera máxima entre intentos (ms). Por defecto 30 000. */
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number, error: LlmError) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Decorador de `LlmProvider` que reintenta los errores recuperables (límite de solicitudes,
 * errores 5xx, red). Necesario en planes gratuitos como el de Groq, cuyo límite de tokens por
 * minuto se alcanza fácilmente porque cada mensaje del usuario hace varias llamadas al modelo.
 */
export class RetryingProvider implements LlmProvider {
  readonly name: string;
  private readonly inner: LlmProvider;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onRetry: RetryOptions['onRetry'];

  constructor(inner: LlmProvider, options: RetryOptions = {}) {
    this.inner = inner;
    this.name = inner.name;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 2000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.sleep = options.sleep ?? defaultSleep;
    this.onRetry = options.onRetry;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.inner.complete(request);
      } catch (error) {
        if (!(error instanceof LlmError) || !error.retryable || attempt >= this.maxRetries) {
          throw error;
        }
        const delay = Math.min(
          error.retryAfterMs ?? this.baseDelayMs * 2 ** attempt,
          this.maxDelayMs,
        );
        this.onRetry?.(attempt + 1, delay, error);
        await this.sleep(delay);
      }
    }
  }
}
