// @vitest-environment node
import { WebSocket } from 'ws';
import type { ServerEvent } from '../src/core/protocol.ts';
import { createMockServer, type MockServer } from './createMockServer.ts';

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function collectUntil(
  socket: WebSocket,
  done: (e: ServerEvent) => boolean,
): Promise<ServerEvent[]> {
  return new Promise((resolve) => {
    const events: ServerEvent[] = [];
    socket.on('message', (raw) => {
      const event = JSON.parse(raw.toString()) as ServerEvent;
      events.push(event);
      if (done(event)) resolve(events);
    });
  });
}

describe('createMockServer', () => {
  let server: MockServer;
  let socket: WebSocket;

  beforeEach(async () => {
    server = await createMockServer({ port: 0, latencyMs: 0, chunkDelayMs: 0 });
    socket = await connect(server.port);
  });

  afterEach(async () => {
    socket.close();
    await server.close();
  });

  it('responde en streaming siguiendo el protocolo', async () => {
    const received = collectUntil(socket, (e) => e.type === 'message_end');
    socket.send(JSON.stringify({ type: 'user_message', id: 'u1', content: 'tabla' }));
    const events = await received;

    expect(events[0]).toMatchObject({ type: 'message_start', replyTo: 'u1' });
    const text = events.map((e) => (e.type === 'message_delta' ? e.delta : '')).join('');
    expect(text).toContain('| Plan |');
    expect(events.at(-1)?.type).toBe('message_end');
  });

  it('reporta errores del agente con el id del mensaje', async () => {
    const received = collectUntil(socket, (e) => e.type === 'error');
    socket.send(JSON.stringify({ type: 'user_message', id: 'u9', content: 'error' }));
    expect((await received)[0]).toMatchObject({ type: 'error', id: 'u9' });
  });

  it('rechaza mensajes que no cumplen el protocolo', async () => {
    const received = collectUntil(socket, (e) => e.type === 'error');
    socket.send('no es json');
    expect((await received)[0]).toMatchObject({
      type: 'error',
      message: expect.stringContaining('inválido'),
    });
  });

  it('no falla si el cliente se desconecta a mitad de la respuesta', async () => {
    const slow = await createMockServer({ port: 0, latencyMs: 20, chunkDelayMs: 1 });
    const client = await connect(slow.port);
    client.send(JSON.stringify({ type: 'user_message', id: 'u1', content: 'hola' }));
    client.terminate();
    await new Promise((r) => setTimeout(r, 60));
    await slow.close();
  });

  it('usa valores por defecto y falla si el puerto está ocupado', async () => {
    const defaults = await createMockServer({ port: 0 });
    await expect(createMockServer({ port: defaults.port })).rejects.toThrow();
    await defaults.close();
  });
});
