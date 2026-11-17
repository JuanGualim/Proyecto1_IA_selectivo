import {
  LlmError,
  type LlmMessage,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type StopReason,
  type ToolCall,
} from './LlmProvider.ts';

/**
 * Adaptador del puerto `LlmProvider` para cualquier API compatible con el formato de
 * "chat completions" de OpenAI: Groq (por defecto, con plan gratuito), NVIDIA NIM, Gemini,
 * OpenRouter, Cerebras u Ollama. Solo cambian `baseUrl`, `apiKey` y `model`.
 *
 * Usa `fetch` nativo (sin SDK) para no agregar dependencias.
 */

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
/** Modelo por defecto en Groq: buen uso de herramientas y disponible en el plan gratuito. */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpenAICompatibleOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** Tokens máximos de la respuesta. Por defecto 2048 (cuenta para el límite por minuto). */
  maxTokens?: number;
  /** Tiempo máximo por solicitud (ms). Por defecto 60 000. */
  timeoutMs?: number;
  /**
   * Esfuerzo de razonamiento para modelos que lo admiten (p. ej. `openai/gpt-oss-*` en Groq).
   * Menos razonamiento = menos tokens consumidos del límite por minuto.
   */
  reasoningEffort?: 'low' | 'medium' | 'high';
  fetchImpl?: FetchLike;
}

interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export class OpenAICompatibleProvider implements LlmProvider {
  readonly name = 'openai-compatible';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly reasoningEffort: OpenAICompatibleOptions['reasoningEffort'];
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleOptions) {
    if (!options.apiKey) throw new LlmError('Falta la llave del proveedor de LLM (LLM_API_KEY).');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? GROQ_BASE_URL).replace(/\/+$/, '');
    this.model = options.model ?? DEFAULT_GROQ_MODEL;
    this.maxTokens = options.maxTokens ?? 2048;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.reasoningEffort = options.reasoningEffort;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const body = {
      model: this.model,
      max_tokens: Math.min(request.maxTokens ?? this.maxTokens, this.maxTokens),
      temperature: 0.3,
      ...(this.reasoningEffort ? { reasoning_effort: this.reasoningEffort } : {}),
      messages: [
        { role: 'system', content: request.system } satisfies ChatMessage,
        ...request.messages.flatMap(toChatMessages),
      ],
      ...(request.tools?.length
        ? {
            tool_choice: 'auto',
            tools: request.tools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            })),
          }
        : {}),
    };

    const response = await this.post(body);
    return fromChatCompletion(await response.json());
  }

  private async post(body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new LlmError('No se pudo contactar al modelo de lenguaje.', true);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw await toLlmError(response);
    return response;
  }
}

/** Convierte el historial neutral al formato de chat completions. */
export function toChatMessages(message: LlmMessage): ChatMessage[] {
  switch (message.role) {
    case 'user':
      return [{ role: 'user', content: message.content }];
    case 'assistant':
      return [
        message.toolCalls.length > 0
          ? {
              role: 'assistant',
              content: message.text || null,
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.input) },
              })),
            }
          : { role: 'assistant', content: message.text },
      ];
    case 'tool_results':
      // A diferencia de Claude, aquí cada resultado es un mensaje `tool` independiente.
      return message.results.map((result) => ({
        role: 'tool',
        tool_call_id: result.toolCallId,
        content: result.isError ? `ERROR: ${result.content}` : result.content,
      }));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Los argumentos llegan como texto JSON; si no son un objeto válido se usa `{}`. */
function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const FINISH_REASONS: Partial<Record<string, StopReason>> = {
  tool_calls: 'tool_use',
  length: 'max_tokens',
  content_filter: 'refusal',
};

export function fromChatCompletion(data: unknown): LlmResponse {
  const choice = isRecord(data) && Array.isArray(data.choices) ? data.choices[0] : undefined;
  if (!isRecord(choice) || !isRecord(choice.message)) {
    throw new LlmError('El modelo de lenguaje devolvió una respuesta inválida.');
  }
  const { message } = choice;
  const toolCalls: ToolCall[] = (Array.isArray(message.tool_calls) ? message.tool_calls : [])
    .filter(isRecord)
    .flatMap((call, index) => {
      const fn = isRecord(call.function) ? call.function : {};
      if (typeof fn.name !== 'string') return [];
      const id = typeof call.id === 'string' ? call.id : `call_${index}`;
      return [{ id, name: fn.name, input: parseArguments(fn.arguments) }];
    });

  const finish = typeof choice.finish_reason === 'string' ? choice.finish_reason : '';
  // Algunos proveedores responden "stop" aunque haya llamadas a herramientas.
  const stopReason =
    toolCalls.length > 0 && finish !== 'length' ? 'tool_use' : (FINISH_REASONS[finish] ?? 'end');
  const usage = isRecord(data) && isRecord(data.usage) ? data.usage : {};

  return {
    text: typeof message.content === 'string' ? message.content.trim() : '',
    toolCalls,
    stopReason,
    usage: {
      inputTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
      outputTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
    },
  };
}

/** Traduce el código HTTP a un error para el usuario, sin detalles internos. */
export async function toLlmError(response: Response): Promise<LlmError> {
  const status = response.status;
  if (status === 401 || status === 403) {
    return new LlmError('El agente no tiene credenciales válidas para el modelo de lenguaje.');
  }
  if (status === 429) {
    const seconds = Number(response.headers.get('retry-after'));
    return new LlmError(
      'El agente está recibiendo muchas solicitudes. Intenta en un momento.',
      true,
      Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined,
    );
  }
  if (status >= 500) return new LlmError('El modelo de lenguaje devolvió un error.', true);
  // Groq responde 400 "tool_use_failed" cuando el modelo genera una llamada mal formada.
  const text = await response.text().catch(() => '');
  return new LlmError('El modelo de lenguaje devolvió un error.', text.includes('tool_use_failed'));
}
