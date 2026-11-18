// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL, toLlmError } from './AnthropicProvider.ts';
import { LlmError, toAssistantMessage, type LlmMessage } from './LlmProvider.ts';

function fakeClient(response: Partial<Anthropic.Beta.BetaMessage>) {
  const create = vi.fn(async (_params: Anthropic.Beta.MessageCreateParamsNonStreaming) => ({
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
    ...response,
  }));
  return { client: { beta: { messages: { create } } } as never, create };
}

describe('AnthropicProvider', () => {
  it('envía modelo, system, herramientas, esfuerzo y fallback por defecto', async () => {
    const { client, create } = fakeClient({
      content: [{ type: 'text', text: 'Hola', citations: null }] as never,
    });
    const provider = new AnthropicProvider({ client });

    const response = await provider.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hola' }],
      tools: [{ name: 't', description: 'd', inputSchema: { type: 'object', properties: {} } }],
    });

    const params = create.mock.calls[0]?.[0];
    expect(params).toMatchObject({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 16000,
      system: 'sys',
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools: [{ name: 't', description: 'd', input_schema: { type: 'object', properties: {} } }],
      messages: [{ role: 'user', content: 'hola' }],
    });
    expect(response).toMatchObject({
      text: 'Hola',
      toolCalls: [],
      stopReason: 'end',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it('omite tools si no hay y respeta modelo y esfuerzo configurados', async () => {
    const { client, create } = fakeClient({});
    await new AnthropicProvider({ client, model: 'claude-haiku-5-5', effort: 'medium' }).complete({
      system: 's',
      messages: [],
      maxTokens: 100,
    });
    const params = create.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty('tools');
    expect(params).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 100 });
    expect(params?.output_config).toEqual({ effort: 'medium' });
  });

  it('extrae llamadas a herramientas y conserva el contenido crudo', async () => {
    const content = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'tu1', name: 'search_movies', input: { query: 'dune' } },
      { type: 'tool_use', id: 'tu2', name: 'raro', input: 'no-objeto' },
    ];
    const { client } = fakeClient({ content: content as never, stop_reason: 'tool_use' });

    const response = await new AnthropicProvider({ client }).complete({
      system: 's',
      messages: [],
    });

    expect(response.stopReason).toBe('tool_use');
    expect(response.toolCalls).toEqual([
      { id: 'tu1', name: 'search_movies', input: { query: 'dune' } },
      { id: 'tu2', name: 'raro', input: {} },
    ]);
    expect(response.raw).toBe(content);
    expect(toAssistantMessage(response)).toMatchObject({ role: 'assistant', raw: content });
  });

  it.each([
    ['max_tokens', 'max_tokens'],
    ['refusal', 'refusal'],
    [null, 'end'],
  ])('traduce stop_reason %s a %s', async (stop, expected) => {
    const { client } = fakeClient({ stop_reason: stop as never });
    const response = await new AnthropicProvider({ client }).complete({
      system: 's',
      messages: [],
    });
    expect(response.stopReason).toBe(expected);
  });

  it('convierte el historial neutral al formato de mensajes de Claude', async () => {
    const { client, create } = fakeClient({});
    const raw = [{ type: 'text', text: 'crudo' }];
    const messages: LlmMessage[] = [
      { role: 'user', content: 'hola' },
      { role: 'assistant', text: 'pensando', toolCalls: [{ id: 'a', name: 'x', input: {} }] },
      { role: 'assistant', text: '', toolCalls: [] },
      {
        role: 'tool_results',
        results: [
          { toolCallId: 'a', content: 'ok' },
          { toolCallId: 'b', content: 'falló', isError: true },
        ],
      },
      { role: 'assistant', text: 'ignorado', toolCalls: [], raw },
    ];

    await new AnthropicProvider({ client }).complete({ system: 's', messages });

    expect(create.mock.calls[0]?.[0].messages).toEqual([
      { role: 'user', content: 'hola' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'pensando' },
          { type: 'tool_use', id: 'a', name: 'x', input: {} },
        ],
      },
      { role: 'assistant', content: [] },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'a', content: 'ok' },
          { type: 'tool_result', tool_use_id: 'b', content: 'falló', is_error: true },
        ],
      },
      { role: 'assistant', content: raw },
    ]);
  });

  it('envuelve los errores del SDK en LlmError', async () => {
    const create = vi.fn(async () => {
      throw new Anthropic.RateLimitError(429, {}, 'rate', new Headers());
    });
    const provider = new AnthropicProvider({ client: { beta: { messages: { create } } } as never });
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      name: 'LlmError',
      retryable: true,
    });
  });

  it('crea su propio cliente si no se inyecta', () => {
    expect(new AnthropicProvider({ apiKey: 'sk-test' }).name).toBe('anthropic');
  });
});

describe('toLlmError', () => {
  it.each([
    [new Anthropic.AuthenticationError(401, {}, 'x', new Headers()), /credenciales/, false],
    [new Anthropic.APIConnectionError({ message: 'x' }), /contactar/, true],
    [new Anthropic.InternalServerError(500, {}, 'x', new Headers()), /error/, true],
    [new Anthropic.BadRequestError(400, {}, 'x', new Headers()), /error/, false],
    [new Error('otro'), /inesperado/, false],
  ])('traduce %s', (error, message, retryable) => {
    const result = toLlmError(error);
    expect(result).toBeInstanceOf(LlmError);
    expect(result.message).toMatch(message);
    expect(result.retryable).toBe(retryable);
  });
});
