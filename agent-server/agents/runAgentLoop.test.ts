// @vitest-environment node
import { ScriptedProvider, textResponse, toolResponse } from '../llm/ScriptedProvider.ts';
import { runAgentLoop } from './runAgentLoop.ts';

const TOOLS = [{ name: 'search_movies', description: 'd', inputSchema: { type: 'object' } }];

describe('runAgentLoop', () => {
  it('responde directamente si el modelo no pide herramientas', async () => {
    const provider = new ScriptedProvider([textResponse('Hola')]);
    const executeTool = vi.fn();

    const result = await runAgentLoop({
      provider,
      system: 's',
      messages: [{ role: 'user', content: 'hola' }],
      tools: TOOLS,
      executeTool,
    });

    expect(result).toMatchObject({ text: 'Hola', stopReason: 'end', steps: 1, toolCalls: [] });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('ejecuta herramientas en paralelo y devuelve los resultados en un solo mensaje', async () => {
    const provider = new ScriptedProvider([
      toolResponse(
        { name: 'search_movies', input: { query: 'a' } },
        { name: 'search_movies', input: { query: 'b' } },
      ),
      textResponse('Encontré dos'),
    ]);
    const executeTool = vi.fn(async (call: { input: Record<string, unknown> }) => ({
      content: `res ${String(call.input.query)}`,
      isError: false,
    }));

    const result = await runAgentLoop({
      provider,
      system: 's',
      messages: [{ role: 'user', content: 'busca' }],
      tools: TOOLS,
      executeTool,
      maxTokens: 500,
    });

    expect(result.text).toBe('Encontré dos');
    expect(result.toolCalls.map((call) => call.outcome.content)).toEqual(['res a', 'res b']);
    const toolMessage = result.messages[2];
    expect(toolMessage).toMatchObject({ role: 'tool_results' });
    expect(toolMessage?.role === 'tool_results' && toolMessage.results).toHaveLength(2);
    expect(provider.requests[1]?.maxTokens).toBe(500);
    expect(provider.requests[1]?.messages).toHaveLength(3);
  });

  it('convierte excepciones de herramientas en resultados con error', async () => {
    const provider = new ScriptedProvider([
      toolResponse({ name: 'search_movies' }),
      textResponse('No pude buscar'),
    ]);

    const result = await runAgentLoop({
      provider,
      system: 's',
      messages: [],
      tools: TOOLS,
      executeTool: async () => {
        throw new Error('caída');
      },
    });

    expect(result.toolCalls[0]?.outcome).toEqual({
      content: 'La herramienta search_movies falló: caída',
      isError: true,
    });
  });

  it('reporta errores no estándar de herramientas', async () => {
    const provider = new ScriptedProvider([toolResponse({ name: 'x' }), textResponse('ok')]);
    const result = await runAgentLoop({
      provider,
      system: 's',
      messages: [],
      tools: TOOLS,
      executeTool: () => Promise.reject('raro'),
    });
    expect(result.toolCalls[0]?.outcome.content).toMatch(/Error desconocido/);
  });

  it('se detiene al llegar al máximo de pasos', async () => {
    const provider = new ScriptedProvider(() => toolResponse({ name: 'search_movies' }));
    const result = await runAgentLoop({
      provider,
      system: 's',
      messages: [],
      tools: TOOLS,
      executeTool: async () => ({ content: 'ok', isError: false }),
      maxSteps: 2,
    });
    expect(result).toMatchObject({ stopReason: 'max_steps', steps: 2, text: '' });
  });

  it('no ejecuta herramientas si la respuesta se cortó por max_tokens', async () => {
    const truncated = { ...toolResponse({ name: 'x' }), stopReason: 'max_tokens' as const };
    const executeTool = vi.fn();
    const result = await runAgentLoop({
      provider: new ScriptedProvider([truncated]),
      system: 's',
      messages: [],
      tools: TOOLS,
      executeTool,
    });
    expect(result.stopReason).toBe('max_tokens');
    expect(executeTool).not.toHaveBeenCalled();
  });
});
