// @vitest-environment node
import { LlmError, type LlmMessage } from './LlmProvider.ts';
import {
  DEFAULT_GROQ_MODEL,
  fromChatCompletion,
  GROQ_BASE_URL,
  OpenAICompatibleProvider,
  toChatMessages,
  toLlmError,
  type FetchLike,
} from './OpenAICompatibleProvider.ts';

function completion(message: Record<string, unknown>, finish = 'stop') {
  return {
    choices: [{ message, finish_reason: finish }],
    usage: { prompt_tokens: 12, completion_tokens: 3 },
  };
}

function fakeFetch(...responses: Array<Response | Error>) {
  return vi.fn<FetchLike>(async () => {
    const next = responses.shift();
    if (!next) throw new Error('sin más respuestas');
    if (next instanceof Error) throw next;
    return next;
  });
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('OpenAICompatibleProvider', () => {
  it('exige una llave', () => {
    expect(() => new OpenAICompatibleProvider({ apiKey: '' })).toThrow(LlmError);
  });

  it('llama a Groq por defecto con system, herramientas y autorización', async () => {
    const fetchImpl = fakeFetch(json(completion({ content: ' Hola ' })));
    const provider = new OpenAICompatibleProvider({ apiKey: 'gsk_test', fetchImpl });

    const response = await provider.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hola' }],
      tools: [{ name: 't', description: 'd', inputSchema: { type: 'object' } }],
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`${GROQ_BASE_URL}/chat/completions`);
    expect(init?.headers).toMatchObject({ authorization: 'Bearer gsk_test' });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: DEFAULT_GROQ_MODEL,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hola' },
      ],
      tool_choice: 'auto',
      tools: [
        {
          type: 'function',
          function: { name: 't', description: 'd', parameters: { type: 'object' } },
        },
      ],
    });
    expect(response).toEqual({
      text: 'Hola',
      toolCalls: [],
      stopReason: 'end',
      usage: { inputTokens: 12, outputTokens: 3 },
    });
  });

  it('usa otra URL y modelo (p. ej. NVIDIA) y omite tools si no hay', async () => {
    const fetchImpl = fakeFetch(json(completion({ content: 'ok' })));
    const provider = new OpenAICompatibleProvider({
      apiKey: 'nvapi-x',
      baseUrl: 'https://integrate.api.nvidia.com/v1/',
      model: 'meta/llama-3.3-70b-instruct',
      maxTokens: 500,
      fetchImpl,
    });

    await provider.complete({ system: 's', messages: [], maxTokens: 9000 });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'meta/llama-3.3-70b-instruct', max_tokens: 500 });
    expect(body).not.toHaveProperty('tools');
  });

  it('convierte errores HTTP y de red en LlmError', async () => {
    const provider = (response: Response | Error) =>
      new OpenAICompatibleProvider({ apiKey: 'k', fetchImpl: fakeFetch(response) });

    await expect(
      provider(json({}, 401)).complete({ system: 's', messages: [] }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/credenciales/),
      retryable: false,
    });
    await expect(
      provider(new TypeError('red')).complete({ system: 's', messages: [] }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/contactar/),
      retryable: true,
    });
  });

  it('aborta la solicitud si se agota el tiempo', async () => {
    const fetchImpl = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const provider = new OpenAICompatibleProvider({ apiKey: 'k', fetchImpl, timeoutMs: 5 });
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toBeInstanceOf(LlmError);
  });
});

describe('toChatMessages', () => {
  it('convierte el historial neutral (incluidos resultados de herramientas)', () => {
    const history: LlmMessage[] = [
      { role: 'user', content: 'hola' },
      {
        role: 'assistant',
        text: '',
        toolCalls: [{ id: 'c1', name: 'search_movies', input: { query: 'dune' } }],
      },
      { role: 'assistant', text: 'pensando', toolCalls: [{ id: 'c2', name: 'x', input: {} }] },
      {
        role: 'tool_results',
        results: [
          { toolCallId: 'c1', content: 'ok' },
          { toolCallId: 'c2', content: 'falló', isError: true },
        ],
      },
      { role: 'assistant', text: 'Listo', toolCalls: [] },
    ];

    expect(history.flatMap(toChatMessages)).toEqual([
      { role: 'user', content: 'hola' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'search_movies', arguments: '{"query":"dune"}' },
          },
        ],
      },
      {
        role: 'assistant',
        content: 'pensando',
        tool_calls: [{ id: 'c2', type: 'function', function: { name: 'x', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', content: 'ok' },
      { role: 'tool', tool_call_id: 'c2', content: 'ERROR: falló' },
      { role: 'assistant', content: 'Listo' },
    ]);
  });
});

describe('fromChatCompletion', () => {
  it('extrae llamadas a herramientas y tolera argumentos inválidos', () => {
    const response = fromChatCompletion(
      completion(
        {
          content: null,
          tool_calls: [
            {
              id: 'a',
              type: 'function',
              function: { name: 'search_movies', arguments: '{"query":"dune"}' },
            },
            { type: 'function', function: { name: 'roto', arguments: '{no json' } },
            { id: 'c', type: 'function', function: { name: 'lista', arguments: '[1]' } },
            { id: 'd', type: 'function', function: { name: 'objeto', arguments: { a: 1 } } },
            { id: 'e', function: { arguments: '{}' } },
            'basura',
          ],
        },
        'tool_calls',
      ),
    );
    expect(response.stopReason).toBe('tool_use');
    expect(response.text).toBe('');
    expect(response.toolCalls).toEqual([
      { id: 'a', name: 'search_movies', input: { query: 'dune' } },
      { id: 'call_1', name: 'roto', input: {} },
      { id: 'c', name: 'lista', input: {} },
      { id: 'd', name: 'objeto', input: {} },
    ]);
  });

  it.each([
    ['length', 'max_tokens'],
    ['content_filter', 'refusal'],
    ['stop', 'end'],
    [undefined, 'end'],
  ])('traduce finish_reason %s a %s', (finish, expected) => {
    expect(fromChatCompletion(completion({ content: 'x' }, finish as string)).stopReason).toBe(
      expected,
    );
  });

  it('usa tool_use si hay llamadas aunque el proveedor diga "stop"', () => {
    const response = fromChatCompletion(
      completion({ tool_calls: [{ id: 'a', function: { name: 'x', arguments: '{}' } }] }, 'stop'),
    );
    expect(response.stopReason).toBe('tool_use');
  });

  it('rechaza respuestas sin choices y tolera la falta de usage', () => {
    expect(() => fromChatCompletion({})).toThrow(/inválida/);
    expect(fromChatCompletion({ choices: [{ message: { content: 'x' } }] }).usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});

describe('toLlmError', () => {
  it.each([
    [403, '', /credenciales/, false],
    [429, '', /muchas solicitudes/, true],
    [503, '', /error/, true],
    [400, '{"error":{"code":"tool_use_failed"}}', /error/, true],
    [400, '{"error":"otro"}', /error/, false],
  ])('HTTP %i', async (status, body, message, retryable) => {
    const error = await toLlmError(new Response(body, { status }));
    expect(error.message).toMatch(message);
    expect(error.retryable).toBe(retryable);
  });
});

describe('retry-after', () => {
  it('lee la espera sugerida en los errores 429', async () => {
    const error = await toLlmError(
      new Response('', { status: 429, headers: { 'retry-after': '7' } }),
    );
    expect(error.retryAfterMs).toBe(7000);
    expect((await toLlmError(new Response('', { status: 429 }))).retryAfterMs).toBeUndefined();
  });
});

describe('reasoning_effort', () => {
  it('se envía solo si se configura', async () => {
    const fetchImpl = fakeFetch(
      json(completion({ content: 'ok' })),
      json(completion({ content: 'ok' })),
    );
    await new OpenAICompatibleProvider({ apiKey: 'k', fetchImpl, reasoningEffort: 'low' }).complete(
      {
        system: 's',
        messages: [],
      },
    );
    await new OpenAICompatibleProvider({ apiKey: 'k', fetchImpl }).complete({
      system: 's',
      messages: [],
    });
    const bodies = fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0]).toMatchObject({ reasoning_effort: 'low' });
    expect(bodies[1]).not.toHaveProperty('reasoning_effort');
  });
});
