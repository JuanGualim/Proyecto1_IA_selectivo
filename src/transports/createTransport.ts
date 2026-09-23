import type { ChatTransport } from './ChatTransport';
import { MockTransport, type MockTransportOptions } from './MockTransport';
import { WebSocketTransport, type WebSocketTransportOptions } from './WebSocketTransport';

/** Configuración declarativa de un transporte (útil para el SDK vanilla / `<script>`). */
export type TransportConfig =
  ({ type: 'mock' } & MockTransportOptions) | ({ type: 'websocket' } & WebSocketTransportOptions);

/** Crea el adaptador correspondiente a la configuración. */
export function createTransport(config: TransportConfig): ChatTransport {
  switch (config.type) {
    case 'mock': {
      const { type: _type, ...options } = config;
      return new MockTransport(options);
    }
    case 'websocket': {
      const { type: _type, ...options } = config;
      return new WebSocketTransport(options);
    }
  }
}
