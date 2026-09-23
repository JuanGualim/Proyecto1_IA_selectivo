import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget, type ChatWidgetProps } from '../components/ChatWidget/ChatWidget';
import type { ChatTransport } from '../transports/ChatTransport';
import { createTransport, type TransportConfig } from '../transports/createTransport';

export interface MountOptions extends Omit<ChatWidgetProps, 'transport'> {
  /** Instancia de transporte o configuración declarativa. Por defecto: `{ type: 'mock' }`. */
  transport?: ChatTransport | TransportConfig;
}

export interface MountedWidget {
  /** Desmonta el widget y cierra la conexión. */
  unmount: () => void;
  transport: ChatTransport;
}

function isTransport(value: ChatTransport | TransportConfig): value is ChatTransport {
  return typeof (value as ChatTransport).connect === 'function';
}

function resolveTarget(target?: HTMLElement | string): { element: HTMLElement; created: boolean } {
  if (target instanceof HTMLElement) return { element: target, created: false };
  if (typeof target === 'string') {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) throw new Error(`[AGIChat] No se encontró el elemento "${target}".`);
    return { element, created: false };
  }
  const element = document.createElement('div');
  element.id = 'agichat-widget';
  document.body.appendChild(element);
  return { element, created: true };
}

/**
 * API "vanilla" del SDK: monta el widget en cualquier página, sin necesidad de React
 * en la aplicación del cliente.
 *
 * @example
 * AGIChat.mountChatWidget({ title: 'Soporte', transport: { type: 'websocket', url: 'wss://…' } });
 */
export function mountChatWidget(
  options: MountOptions = {},
  target?: HTMLElement | string,
): MountedWidget {
  const { transport: transportOption = { type: 'mock' }, ...props } = options;
  const transport = isTransport(transportOption)
    ? transportOption
    : createTransport(transportOption);
  const { element, created } = resolveTarget(target);
  const root = createRoot(element);

  root.render(
    <StrictMode>
      <ChatWidget transport={transport} {...props} />
    </StrictMode>,
  );

  return {
    transport,
    unmount: () => {
      root.unmount();
      if (created) element.remove();
    },
  };
}
