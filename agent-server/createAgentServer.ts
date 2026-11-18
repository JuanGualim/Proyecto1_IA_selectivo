import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientEvent, safeJsonParse, type ServerEvent } from '../src/core/protocol.ts';
import { chunkText } from '../src/transports/mock/responder.ts';
import type { ConversationTurn, TurnResult } from './agents/Orchestrator.ts';
import { LlmError } from './llm/LlmProvider.ts';

/** Lo que el servidor necesita del agente (lo implementa `Orchestrator`). */
export interface ChatAgent {
  handle(history: ConversationTurn[], userText: string): Promise<TurnResult>;
}

export interface AgentServerOptions {
  agent: ChatAgent;
  port?: number;
  host?: string;
  /** Orígenes de navegador permitidos. Vacío = cualquiera (solo para desarrollo). */
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  /** Pausa entre fragmentos del streaming (ms). */
  chunkDelayMs?: number;
  /** Turnos guardados por conexión. */
  maxHistory?: number;
  log?: (message: string) => void;
}

export interface AgentServer {
  port: number;
  close: () => Promise<void>;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function send(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
}

/**
 * Servidor WebSocket del agente real. Habla el mismo protocolo que el servidor mock
 * (`src/core/protocol.ts`), por lo que el widget se conecta sin cambios con `WebSocketTransport`.
 *
 * Protecciones: verificación de origen (evita Cross-Site WebSocket Hijacking), límite de
 * mensajes por minuto, un mensaje en curso por conexión y errores sin detalles internos.
 */
export function createAgentServer(options: AgentServerOptions): Promise<AgentServer> {
  const {
    agent,
    port = 8788,
    host = '127.0.0.1',
    allowedOrigins = [],
    rateLimitPerMinute = 12,
    chunkDelayMs = 15,
    maxHistory = 20,
    log = (message: string) => console.error(message),
  } = options;

  const wss = new WebSocketServer({
    port,
    host,
    maxPayload: 16 * 1024,
    verifyClient: ({ req }: { req: IncomingMessage }) => {
      const origin = req.headers.origin;
      return !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);
    },
  });

  wss.on('connection', (socket) => {
    const history: ConversationTurn[] = [];
    const recent: number[] = [];
    let busy = false;

    socket.on('message', async (raw) => {
      const event = parseClientEvent(safeJsonParse(raw.toString()));
      if (!event) {
        send(socket, { type: 'error', message: 'Mensaje inválido: no cumple el protocolo.' });
        return;
      }
      if (busy) {
        send(socket, {
          type: 'error',
          id: event.id,
          message: 'Espera a que termine la respuesta anterior.',
        });
        return;
      }
      const now = Date.now();
      while (recent.length > 0 && now - (recent[0] ?? 0) > 60_000) recent.shift();
      if (recent.length >= rateLimitPerMinute) {
        send(socket, {
          type: 'error',
          id: event.id,
          message: 'Enviaste demasiados mensajes. Espera un minuto e inténtalo de nuevo.',
        });
        return;
      }
      recent.push(now);

      busy = true;
      try {
        const result = await agent.handle([...history], event.content);
        if (
          result.blocked ||
          result.security.outputReasons.length > 0 ||
          result.security.indirectInjection
        ) {
          // Solo se registran categorías, nunca el contenido del usuario.
          log(
            `[seguridad] bloqueado=${result.blocked} entrada=${result.security.input.categories.join(',') || '-'} ` +
              `salida=${result.security.outputReasons.join(',') || '-'} indirecta=${result.security.indirectInjection}`,
          );
        }
        const { text } = result;
        history.push(
          { role: 'user', content: event.content },
          { role: 'assistant', content: text },
        );
        history.splice(0, Math.max(0, history.length - maxHistory));

        const id = `msg_${randomUUID()}`;
        send(socket, { type: 'message_start', id, replyTo: event.id });
        // Primero las pestañas: el widget las abre sin que el usuario haga clic.
        for (const action of result.actions) {
          send(socket, {
            type: 'open_url',
            id,
            url: action.url,
            label: action.label,
            ...(action.openedOnHost ? { openedByServer: true } : {}),
          });
        }
        for (const delta of chunkText(text)) {
          send(socket, { type: 'message_delta', id, delta });
          if (chunkDelayMs > 0) await wait(chunkDelayMs);
        }
        send(socket, { type: 'message_end', id });
      } catch (error) {
        log(`[agente] error: ${error instanceof Error ? error.name : 'desconocido'}`);
        send(socket, {
          type: 'error',
          id: event.id,
          message:
            error instanceof LlmError
              ? error.message
              : 'El agente tuvo un problema al responder. Intenta de nuevo.',
        });
      } finally {
        busy = false;
      }
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
