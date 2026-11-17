// @vitest-environment node
import { lastUserText, ScriptedProvider, textResponse, toolResponse } from './ScriptedProvider.ts';

describe('ScriptedProvider', () => {
  it('responde en orden con una cola de respuestas y registra las solicitudes', async () => {
    const provider = new ScriptedProvider([
      toolResponse({ name: 'search_movies', input: { query: 'dune' } }),
      textResponse('listo'),
    ]);

    const first = await provider.complete({ system: 's', messages: [] });
    const second = await provider.complete({ system: 's', messages: [] });

    expect(first.stopReason).toBe('tool_use');
    expect(first.toolCalls[0]).toMatchObject({ name: 'search_movies', input: { query: 'dune' } });
    expect(second).toEqual({ text: 'listo', toolCalls: [], stopReason: 'end' });
    expect(provider.requests).toHaveLength(2);
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toThrow(/llamada 3/);
  });

  it('acepta un guion dinámico', async () => {
    const provider = new ScriptedProvider((request) =>
      textResponse(`eco: ${lastUserText(request)}`),
    );
    const response = await provider.complete({
      system: 's',
      messages: [
        { role: 'user', content: 'primero' },
        { role: 'assistant', text: 'ok', toolCalls: [] },
        { role: 'user', content: 'segundo' },
      ],
    });
    expect(response.text).toBe('eco: segundo');
  });

  it('lastUserText devuelve vacío si no hay mensajes de usuario', () => {
    expect(lastUserText({ system: 's', messages: [] })).toBe('');
    expect(toolResponse({ name: 'x' }).toolCalls[0]?.input).toEqual({});
  });
});
