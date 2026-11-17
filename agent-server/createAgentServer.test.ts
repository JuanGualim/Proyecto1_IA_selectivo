// @vitest-environment node
import { WebSocket } from 'ws';
import type { ServerEvent } from '../src/core/protocol.ts';
import type { TurnResult } from './agents/Orchestrator.ts';
import { createAgentServer, type AgentServer, type ChatAgent } from './createAgentServer.ts';
import { LlmError } from './llm/LlmProvider.ts';

function result(text: string, overrides: Partial<TurnResult> = {}): TurnResult {
  return {
    text,
    blocked: false,
    movies: [],
    actions: [],
    security: {
      input: { risk: 'none', categories: [] },
      outputReasons: [],
      indirectInjection: false,
    },
    ...overrides,
  };
}

function connect(port: number, origin?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : undefined);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function collect(
  socket: WebSocket,
  until: (event: ServerEvent) => boolean,
): Promise<ServerEvent[]> {
  return new Promise((resolve) => {
    const events: ServerEvent[] = [];
    socket.on('message', (raw) => {
      const event = JSON.parse(raw.toString()) as ServerEvent;
      events.push(event);
      if (until(event)) resolve(events);
    });
  });
}

const userMessage = (id: string, content: string) =>
  JSON.stringify({ type: 'user_message', id, content });

const textOf = (events: ServerEvent[]) =>
  events.map((event) => (event.type === 'message_delta' ? event.delta : '')).join('');

describe('createAgentServer', () => {
  let server: AgentServer;
  let agent: ChatAgent & { handle: ReturnType<typeof vi.fn> };
  const log = vi.fn();

  beforeEach(async () => {
    agent = { handle: vi.fn(async () => result('Te recomiendo **Dune**.')) };
    server = await createAgentServer({
      agent,
      port: 0,
      chunkDelayMs: 0,
      allowedOrigins: ['http://localhost:5173'],
      rateLimitPerMinute: 3,
      log,
    });
  });

  afterEach(async () => {
    await server.close();
    log.mockReset();
  });

  it('responde en streaming con el protocolo del widget y guarda el historial', async () => {
    const socket = await connect(server.port, 'http://localhost:5173');
    const first = collect(socket, (event) => event.type === 'message_end');
    socket.send(userMessage('u1', 'Recomiéndame algo'));
    const events = await first;

    expect(events[0]).toMatchObject({ type: 'message_start', replyTo: 'u1' });
    expect(textOf(events)).toBe('Te recomiendo **Dune**.');

    const second = collect(socket, (event) => event.type === 'message_end');
    socket.send(userMessage('u2', '¿Y otra?'));
    await second;
    expect(agent.handle).toHaveBeenLastCalledWith(
      [
        { role: 'user', content: 'Recomiéndame algo' },
        { role: 'assistant', content: 'Te recomiendo **Dune**.' },
      ],
      '¿Y otra?',
    );
    socket.close();
  });

  it('agrega los enlaces abiertos y registra eventos de seguridad sin el contenido', async () => {
    agent.handle.mockResolvedValueOnce(
      result('Abrí IMDb.', {
        actions: [{ site: 'imdb', url: 'https://www.imdb.com/title/tt1160419/', label: 'IMDb' }],
        security: {
          input: { risk: 'medium', categories: ['role_hijack'] },
          outputReasons: ['untrusted_urls_removed'],
          indirectInjection: false,
        },
      }),
    );
    const socket = await connect(server.port);
    const done = collect(socket, (event) => event.type === 'message_end');
    socket.send(userMessage('u1', 'secreto del usuario'));

    expect(textOf(await done)).toBe(
      'Abrí IMDb.\n\n🔗 [IMDb](https://www.imdb.com/title/tt1160419/)',
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('entrada=role_hijack'));
    expect(log.mock.calls.flat().join()).not.toContain('secreto del usuario');
    socket.close();
  });

  it('rechaza conexiones de orígenes no permitidos', async () => {
    await expect(connect(server.port, 'https://evil.test')).rejects.toThrow();
  });

  it('valida el protocolo, evita mensajes simultáneos y limita la frecuencia', async () => {
    let release: () => void = () => undefined;
    agent.handle.mockImplementationOnce(
      () => new Promise<TurnResult>((resolve) => (release = () => resolve(result('ok')))),
    );
    const socket = await connect(server.port);
    const errors: ServerEvent[] = [];
    socket.on('message', (raw) => {
      const event = JSON.parse(raw.toString()) as ServerEvent;
      if (event.type === 'error') errors.push(event);
    });

    socket.send('no es json');
    socket.send(userMessage('u1', 'uno'));
    await vi.waitFor(() => expect(agent.handle).toHaveBeenCalledTimes(1));
    socket.send(userMessage('u2', 'dos'));
    await vi.waitFor(() => expect(errors).toHaveLength(2));
    release();

    const end = collect(socket, (event) => event.type === 'message_end');
    await end;
    socket.send(userMessage('u3', 'tres'));
    socket.send(userMessage('u4', 'cuatro'));
    await vi.waitFor(() => expect(errors.length).toBeGreaterThanOrEqual(3));

    expect(errors[0]).toMatchObject({ message: expect.stringContaining('inválido') });
    expect(errors[1]).toMatchObject({ id: 'u2', message: expect.stringContaining('Espera') });
    expect(errors.at(-1)).toMatchObject({ message: expect.stringMatching(/demasiados|Espera/) });
    socket.close();
  });

  it('traduce errores del agente sin exponer detalles internos', async () => {
    agent.handle
      .mockRejectedValueOnce(new LlmError('El modelo de lenguaje devolvió un error.'))
      .mockRejectedValueOnce(new Error('stack interno con /ruta/secreta'));
    const socket = await connect(server.port);

    const first = collect(socket, (event) => event.type === 'error');
    socket.send(userMessage('u1', 'hola'));
    expect((await first)[0]).toMatchObject({
      id: 'u1',
      message: 'El modelo de lenguaje devolvió un error.',
    });

    const second = collect(socket, (event) => event.type === 'error' && event.id === 'u2');
    socket.send(userMessage('u2', 'hola'));
    const events = await second;
    expect(JSON.stringify(events)).not.toContain('ruta/secreta');
    socket.close();
  });

  it('acepta cualquier origen si no hay lista y falla si el puerto está ocupado', async () => {
    const open = await createAgentServer({ agent, port: 0, log });
    const socket = await connect(open.port, 'https://cualquiera.test');
    socket.close();
    await expect(createAgentServer({ agent, port: open.port, log })).rejects.toThrow();
    await open.close();
  });
});
