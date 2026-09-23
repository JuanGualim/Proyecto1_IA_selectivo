import type { ClientEvent, ServerEvent } from '../core/protocol';
import type { ConnectionStatus } from '../core/types';

export type ServerEventListener = (event: ServerEvent) => void;
export type StatusListener = (status: ConnectionStatus) => void;
export type Unsubscribe = () => void;

/**
 * Puerto (interfaz) de comunicación entre el widget y un backend de agente.
 *
 * La UI solo conoce esta interfaz. Para conectar un agente real en la fase 2 basta con
 * crear un nuevo adaptador que la implemente (o usar `WebSocketTransport`), sin tocar la UI.
 */
export interface ChatTransport {
  readonly status: ConnectionStatus;
  /** Abre la conexión. Debe ser idempotente y permitir reconectar tras `disconnect()`. */
  connect(): void;
  /** Cierra la conexión y cancela cualquier trabajo pendiente. */
  disconnect(): void;
  /** Envía un evento al backend. Lanza un `Error` si no es posible enviarlo. */
  send(event: ClientEvent): void;
  /** Escucha eventos del backend. */
  subscribe(listener: ServerEventListener): Unsubscribe;
  /** Escucha cambios de estado de la conexión. */
  onStatusChange(listener: StatusListener): Unsubscribe;
}

/** Implementación base con la gestión de listeners y estado compartida por los adaptadores. */
export abstract class BaseTransport implements ChatTransport {
  private eventListeners = new Set<ServerEventListener>();
  private statusListeners = new Set<StatusListener>();
  private currentStatus: ConnectionStatus = 'idle';

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  abstract connect(): void;
  abstract disconnect(): void;
  abstract send(event: ClientEvent): void;

  subscribe(listener: ServerEventListener): Unsubscribe {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  onStatusChange(listener: StatusListener): Unsubscribe {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  protected emit(event: ServerEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  protected setStatus(status: ConnectionStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export class TransportNotConnectedError extends Error {
  constructor() {
    super('No hay conexión con el agente. Intenta de nuevo en unos segundos.');
    this.name = 'TransportNotConnectedError';
  }
}
