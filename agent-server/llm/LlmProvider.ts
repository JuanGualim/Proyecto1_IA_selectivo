/**
 * Puerto (interfaz) hacia el modelo de lenguaje.
 *
 * Los agentes solo dependen de estos tipos neutrales; cambiar de proveedor (Anthropic,
 * un modelo local, otro proveedor) es escribir un adaptador nuevo, igual que en el widget
 * se cambia de `ChatTransport`.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema del objeto de entrada. */
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export type LlmMessage =
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      /** Contenido nativo del proveedor (p. ej. bloques de thinking) para reenviarlo intacto. */
      raw?: unknown;
    }
  | { role: 'tool_results'; results: ToolResult[] };

export type StopReason = 'end' | 'tool_use' | 'max_tokens' | 'refusal';

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  raw?: unknown;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/** Error del proveedor con un mensaje apto para el usuario. */
export class LlmError extends Error {
  readonly retryable: boolean;
  /** Espera sugerida por el proveedor antes de reintentar (cabecera `retry-after`). */
  readonly retryAfterMs: number | undefined;

  constructor(message: string, retryable = false, retryAfterMs?: number) {
    super(message);
    this.name = 'LlmError';
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Convierte la respuesta del modelo en el mensaje de asistente que se agrega al historial. */
export function toAssistantMessage(response: LlmResponse): LlmMessage {
  return {
    role: 'assistant',
    text: response.text,
    toolCalls: response.toolCalls,
    ...(response.raw === undefined ? {} : { raw: response.raw }),
  };
}
