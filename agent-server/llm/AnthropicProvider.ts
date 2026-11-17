import Anthropic from '@anthropic-ai/sdk';
import {
  LlmError,
  type LlmMessage,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type StopReason,
  type ToolCall,
} from './LlmProvider.ts';

type BetaMessages = Anthropic['beta']['messages'];
type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;

export type Effort = 'low' | 'medium' | 'high';

export interface AnthropicProviderOptions {
  model?: string;
  effort?: Effort;
  /** Cliente inyectable (en tests). Por defecto lee ANTHROPIC_API_KEY del entorno. */
  client?: { beta: { messages: Pick<BetaMessages, 'create'> } };
  apiKey?: string;
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Adaptador del puerto `LlmProvider` para la API de mensajes de Claude (SDK oficial). */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly model: string;
  private readonly effort: Effort;
  private readonly client: { beta: { messages: Pick<BetaMessages, 'create'> } };

  constructor(options: AnthropicProviderOptions = {}) {
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.effort = options.effort ?? 'low';
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const params: CreateParams = {
      model: this.model,
      max_tokens: request.maxTokens ?? 16000,
      system: request.system,
      messages: request.messages.map(toAnthropicMessage),
      // Esfuerzo bajo: el agente conversa y llama herramientas, no resuelve problemas largos.
      output_config: { effort: this.effort },
      // Si el modelo declina por seguridad, la API reintenta con un modelo de respaldo.
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
            })),
          }
        : {}),
    };

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await this.client.beta.messages.create(params);
    } catch (error) {
      throw toLlmError(error);
    }
    return fromAnthropicMessage(message);
  }
}

function toAnthropicMessage(message: LlmMessage): BetaMessageParam {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.content };
    case 'assistant': {
      // Se reenvía el contenido original (incluye bloques de thinking) sin modificarlo.
      if (Array.isArray(message.raw)) {
        return { role: 'assistant', content: message.raw as BetaContentBlock[] };
      }
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (message.text) content.push({ type: 'text', text: message.text });
      for (const call of message.toolCalls) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
      }
      return { role: 'assistant', content };
    }
    case 'tool_results':
      // Todos los resultados van en un único mensaje de usuario.
      return {
        role: 'user',
        content: message.results.map((result) => ({
          type: 'tool_result' as const,
          tool_use_id: result.toolCallId,
          content: result.content,
          ...(result.isError ? { is_error: true } : {}),
        })),
      };
  }
}

const STOP_REASONS: Partial<Record<string, StopReason>> = {
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  refusal: 'refusal',
};

function fromAnthropicMessage(message: Anthropic.Beta.BetaMessage): LlmResponse {
  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const block of message.content) {
    if (block.type === 'text') texts.push(block.text);
    if (block.type === 'tool_use') {
      const input =
        typeof block.input === 'object' && block.input !== null && !Array.isArray(block.input)
          ? (block.input as Record<string, unknown>)
          : {};
      toolCalls.push({ id: block.id, name: block.name, input });
    }
  }
  return {
    text: texts.join('\n').trim(),
    toolCalls,
    stopReason: STOP_REASONS[message.stop_reason ?? ''] ?? 'end',
    raw: message.content,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

/** Traduce los errores tipados del SDK a mensajes para el usuario (sin detalles internos). */
export function toLlmError(error: unknown): LlmError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new LlmError('El agente no tiene credenciales válidas para el modelo de lenguaje.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError(
      'El agente está recibiendo muchas solicitudes. Intenta en un momento.',
      true,
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmError('No se pudo contactar al modelo de lenguaje.', true);
  }
  if (error instanceof Anthropic.APIError) {
    const retryable = typeof error.status === 'number' && error.status >= 500;
    return new LlmError('El modelo de lenguaje devolvió un error.', retryable);
  }
  return new LlmError('Error inesperado al consultar el modelo de lenguaje.');
}
