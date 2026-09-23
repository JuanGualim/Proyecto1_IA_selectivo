import { act, screen } from '@testing-library/react';
import { FakeTransport } from '../test/FakeTransport';
import { MockTransport } from '../transports/MockTransport';
import { WebSocketTransport } from '../transports/WebSocketTransport';
import { mountChatWidget } from './mountChatWidget';

describe('mountChatWidget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('monta en un contenedor creado automáticamente con MockTransport por defecto', async () => {
    let widget!: ReturnType<typeof mountChatWidget>;
    await act(async () => {
      widget = mountChatWidget({ assistantName: 'Soporte', defaultOpen: true });
    });
    expect(widget.transport).toBeInstanceOf(MockTransport);
    expect(document.getElementById('agichat-widget')).not.toBeNull();
    expect(screen.getByRole('dialog', { name: 'Chat con Soporte' })).toBeInTheDocument();

    await act(async () => widget.unmount());
    expect(document.getElementById('agichat-widget')).toBeNull();
  });

  it('monta en un selector existente y acepta una instancia de transporte', async () => {
    document.body.innerHTML = '<div id="chat"></div>';
    const transport = new FakeTransport();
    let widget!: ReturnType<typeof mountChatWidget>;
    await act(async () => {
      widget = mountChatWidget({ transport, mode: 'inline' }, '#chat');
    });
    expect(widget.transport).toBe(transport);
    expect(transport.connectCalls).toBeGreaterThan(0);
    await act(async () => widget.unmount());
    expect(document.getElementById('chat')).not.toBeNull();
    expect(transport.status).toBe('closed');
  });

  it('acepta un HTMLElement y una configuración de WebSocket', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const fakeWs = vi.fn(function (this: { readyState: number; close: () => void }) {
      this.readyState = 0;
      this.close = () => {};
    });
    let widget!: ReturnType<typeof mountChatWidget>;
    await act(async () => {
      widget = mountChatWidget(
        {
          transport: {
            type: 'websocket',
            url: 'ws://x',
            WebSocketImpl: fakeWs as unknown as typeof WebSocket,
          },
        },
        element,
      );
    });
    expect(widget.transport).toBeInstanceOf(WebSocketTransport);
    expect(fakeWs).toHaveBeenCalledWith('ws://x', undefined);
    await act(async () => widget.unmount());
  });

  it('lanza un error claro si el selector no existe', () => {
    expect(() => mountChatWidget({}, '#no-existe')).toThrow('No se encontró el elemento');
  });
});
