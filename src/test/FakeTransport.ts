import type { ClientEvent, ServerEvent } from '../core/protocol';
import type { ConnectionStatus } from '../core/types';
import { BaseTransport } from '../transports/ChatTransport';

/** Transporte controlable desde los tests: registra lo enviado y permite emitir eventos. */
export class FakeTransport extends BaseTransport {
  sent: ClientEvent[] = [];
  connectCalls = 0;
  disconnectCalls = 0;
  failOnSend: Error | null = null;
  autoOpen = true;

  connect(): void {
    this.connectCalls += 1;
    if (this.autoOpen) this.setStatus('open');
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.setStatus('closed');
  }

  send(event: ClientEvent): void {
    if (this.failOnSend) throw this.failOnSend;
    this.sent.push(event);
  }

  serverEmit(event: ServerEvent): void {
    this.emit(event);
  }

  changeStatus(status: ConnectionStatus): void {
    this.setStatus(status);
  }

  /** Simula una respuesta completa del agente. */
  reply(id: string, content: string): void {
    this.emit({ type: 'message_start', id });
    this.emit({ type: 'message_delta', id, delta: content });
    this.emit({ type: 'message_end', id });
  }
}
