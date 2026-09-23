import { createId } from '../core/id';
import type { ClientEvent } from '../core/protocol';
import { BaseTransport, TransportNotConnectedError } from './ChatTransport';
import { chunkText, defaultResponder, type MockResponder } from './mock/responder';

export interface MockTransportOptions {
  /** Función que genera la respuesta simulada. */
  responder?: MockResponder;
  /** Tiempo de conexión simulado (ms). */
  connectDelayMs?: number;
  /** Tiempo que "piensa" el agente antes de responder (ms). */
  latencyMs?: number;
  /** Tiempo entre fragmentos de la respuesta en streaming (ms). */
  chunkDelayMs?: number;
}

/**
 * Adaptador que simula un endpoint de WebSockets dentro del navegador.
 * Emite exactamente los mismos eventos del protocolo que un backend real
 * (`message_start` → `message_delta`* → `message_end`), con latencia y streaming.
 */
export class MockTransport extends BaseTransport {
  private readonly responder: MockResponder;
  private readonly connectDelayMs: number;
  private readonly latencyMs: number;
  private readonly chunkDelayMs: number;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(options: MockTransportOptions = {}) {
    super();
    this.responder = options.responder ?? defaultResponder;
    this.connectDelayMs = options.connectDelayMs ?? 150;
    this.latencyMs = options.latencyMs ?? 600;
    this.chunkDelayMs = options.chunkDelayMs ?? 35;
  }

  connect(): void {
    if (this.status === 'open' || this.status === 'connecting') return;
    this.setStatus('connecting');
    this.schedule(this.connectDelayMs, () => this.setStatus('open'));
  }

  disconnect(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.setStatus('closed');
  }

  send(event: ClientEvent): void {
    if (this.status !== 'open') throw new TransportNotConnectedError();

    const reply = this.responder(event.content);
    const responseId = createId('msg');

    this.schedule(this.latencyMs, () => {
      if ('error' in reply) {
        this.emit({ type: 'error', message: reply.error, id: event.id });
        return;
      }
      this.emit({ type: 'message_start', id: responseId, replyTo: event.id });
      this.streamChunks(responseId, chunkText(reply.content));
    });
  }

  private streamChunks(id: string, chunks: string[], index = 0): void {
    const chunk = chunks[index];
    if (chunk === undefined) {
      this.emit({ type: 'message_end', id });
      return;
    }
    this.emit({ type: 'message_delta', id, delta: chunk });
    this.schedule(this.chunkDelayMs, () => this.streamChunks(id, chunks, index + 1));
  }

  private schedule(delayMs: number, callback: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delayMs);
    this.timers.add(timer);
  }
}
