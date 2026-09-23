import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientEvent, safeJsonParse, type ServerEvent } from '../src/core/protocol.ts';
import {
  chunkText,
  defaultResponder,
  type MockResponder,
} from '../src/transports/mock/responder.ts';

export interface MockServerOptions {
  port?: number;
  host?: string;
  latencyMs?: number;
  chunkDelayMs?: number;
  responder?: MockResponder;
}

export interface MockServer {
  /** Puerto real en el que escucha (útil con `port: 0`). */
  port: number;
  close: () => Promise<void>;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function send(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
}

/**
 * Servidor WebSocket que simula al agente con el mismo protocolo que usará el agente real.
 * En la fase 2 se reemplaza por el backend del agente sin cambiar el widget.
 */
export function createMockServer(options: MockServerOptions = {}): Promise<MockServer> {
  const {
    port = 8787,
    host = '127.0.0.1',
    latencyMs = 600,
    chunkDelayMs = 35,
    responder = defaultResponder,
  } = options;

  const wss = new WebSocketServer({ port, host });

  wss.on('connection', (socket) => {
    socket.on('message', async (raw) => {
      const event = parseClientEvent(safeJsonParse(raw.toString()));
      if (!event) {
        send(socket, { type: 'error', message: 'Mensaje inválido: no cumple el protocolo.' });
        return;
      }

      await wait(latencyMs);
      const reply = responder(event.content);
      if ('error' in reply) {
        send(socket, { type: 'error', message: reply.error, id: event.id });
        return;
      }

      const id = `msg_${randomUUID()}`;
      send(socket, { type: 'message_start', id, replyTo: event.id });
      for (const delta of chunkText(reply.content)) {
        send(socket, { type: 'message_delta', id, delta });
        await wait(chunkDelayMs);
      }
      send(socket, { type: 'message_end', id });
    });
  });

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      resolve({
        port: typeof address === 'object' && address !== null ? address.port : port,
        close: () =>
          new Promise<void>((done) => {
            wss.clients.forEach((client) => client.terminate());
            wss.close(() => done());
          }),
      });
    });
  });
}
