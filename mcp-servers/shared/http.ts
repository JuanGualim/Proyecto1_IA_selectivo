/**
 * Cliente HTTP mínimo compartido por los servidores MCP.
 *
 * Usa `fetch` nativo de Node, con tiempo límite y errores tipados. `fetch` se inyecta
 * para poder probar los clientes sin red.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface FetchJsonOptions {
  fetchImpl?: FetchLike;
  headers?: Record<string, string>;
  /** Tiempo máximo de espera en milisegundos. Por defecto 8000. */
  timeoutMs?: number;
}

/** Hace un GET y devuelve el JSON. Lanza `HttpError` si la respuesta no es 2xx o expira. */
export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const { fetchImpl = fetch, headers = {}, timeoutMs = 8000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpError(response.status, `La API respondió ${response.status}.`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      throw new HttpError(504, 'La API tardó demasiado en responder.');
    }
    throw new HttpError(502, 'No se pudo contactar a la API externa.');
  } finally {
    clearTimeout(timer);
  }
}

/** Construye una URL con parámetros de consulta, omitiendo los valores vacíos. */
export function buildUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
