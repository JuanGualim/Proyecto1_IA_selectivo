import type { ClientEvent } from '../core/protocol';
import { parseServerEvent, safeJsonParse } from '../core/protocol';
import { BaseTransport, TransportNotConnectedError } from './ChatTransport';

/** Subconjunto del constructor de WebSocket que usamos (permite inyectar un doble en tests). */
export type WebSocketFactory = new (url: string, protocols?: string | string[]) => WebSocket;

export interface WebSocketTransportOptions {
  /** URL del endpoint, p. ej. `ws://localhost:8787`. */
  url: string;
  protocols?: string | string[];
  /** Reintentar automáticamente si la conexión se cae. Por defecto `true`. */
  reconnect?: boolean;
  /** Número máximo de reintentos consecutivos. Por defecto 5. */
  maxRetries?: number;
  /** Retardo base del backoff exponencial (ms). Por defecto 500. */
  retryDelayMs?: number;
  /** Implementación de WebSocket a usar. Por defecto `globalThis.WebSocket`. */
  WebSocketImpl?: WebSocketFactory;
}

const OPEN = 1;
const CONNECTING = 0;

/**
 * Adaptador para un backend real (o el servidor mock) por WebSocket.
 * Envía/recibe JSON según `core/protocol.ts`, con cola de envío y reconexión con backoff.
 */
export class WebSocketTransport extends BaseTransport {
  private socket: WebSocket | null = null;
  private queue: string[] = [];
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private readonly options: Required<Omit<WebSocketTransportOptions, 'protocols'>> &
    Pick<WebSocketTransportOptions, 'protocols'>;

  constructor(options: WebSocketTransportOptions) {
    super();
    this.options = {
      reconnect: true,
      maxRetries: 5,
      retryDelayMs: 500,
      WebSocketImpl: globalThis.WebSocket,
      ...options,
    };
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === OPEN || this.socket.readyState === CONNECTING)) {
      return;
    }
    this.manuallyClosed = false;
    this.clearRetryTimer();
    this.setStatus('connecting');

    let socket: WebSocket;
    try {
      socket = new this.options.WebSocketImpl(this.options.url, this.options.protocols);
    } catch {
      this.setStatus('error');
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this.setStatus('open');
      this.flushQueue();
    };
    socket.onmessage = (message: MessageEvent) => {
      if (typeof message.data !== 'string') return;
      const event = parseServerEvent(safeJsonParse(message.data));
      if (event) {
        this.emit(event);
      } else {
        console.warn('[AGIChat] Evento inválido ignorado:', message.data);
      }
    };
    socket.onclose = () => this.handleClose(socket);
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearRetryTimer();
    this.queue = [];
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setStatus('closed');
  }

  send(event: ClientEvent): void {
    const payload = JSON.stringify(event);
    if (this.socket?.readyState === OPEN) {
      this.socket.send(payload);
      return;
    }
    if (this.status === 'connecting') {
      this.queue.push(payload);
      return;
    }
    throw new TransportNotConnectedError();
  }

  private handleClose(socket: WebSocket): void {
    // Ignora cierres de sockets antiguos (p. ej. tras disconnect + connect).
    if (socket !== this.socket) return;
    this.socket = null;
    if (this.manuallyClosed) return;

    const { reconnect, maxRetries, retryDelayMs } = this.options;
    if (!reconnect || this.retries >= maxRetries) {
      this.setStatus('error');
      return;
    }
    // Se notifica el cierre (para cancelar respuestas en curso) y luego se reintenta.
    this.setStatus('closed');
    const delay = retryDelayMs * 2 ** this.retries;
    this.retries += 1;
    this.setStatus('connecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private flushQueue(): void {
    const pending = this.queue;
    this.queue = [];
    pending.forEach((payload) => this.socket?.send(payload));
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
