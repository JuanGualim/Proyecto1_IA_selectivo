import type { ServerEvent } from '../core/protocol';
import { TransportNotConnectedError } from './ChatTransport';
import { WebSocketTransport, type WebSocketFactory } from './WebSocketTransport';

/** Doble de WebSocket que permite controlar apertura, mensajes y cierre. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  // Helpers de test
  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }

  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const last = () => FakeWebSocket.instances.at(-1) as FakeWebSocket;

function setup(options: Partial<ConstructorParameters<typeof WebSocketTransport>[0]> = {}) {
  const transport = new WebSocketTransport({
    url: 'ws://test',
    WebSocketImpl: FakeWebSocket as unknown as WebSocketFactory,
    retryDelayMs: 100,
    ...options,
  });
  const events: ServerEvent[] = [];
  const statuses: string[] = [];
  transport.subscribe((event) => events.push(event));
  transport.onStatusChange((status) => statuses.push(status));
  return { transport, events, statuses };
}

describe('WebSocketTransport', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('se conecta y notifica el estado', () => {
    const { transport, statuses } = setup({ protocols: 'agichat' });
    transport.connect();
    expect(last().url).toBe('ws://test');
    expect(last().protocols).toBe('agichat');
    expect(transport.status).toBe('connecting');
    last().open();
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('no abre un segundo socket si ya hay uno activo', () => {
    const { transport } = setup();
    transport.connect();
    transport.connect();
    last().open();
    transport.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('envía eventos serializados en JSON', () => {
    const { transport } = setup();
    transport.connect();
    last().open();
    transport.send({ type: 'user_message', id: 'u1', content: 'hola' });
    expect(JSON.parse(last().sent[0] as string)).toEqual({
      type: 'user_message',
      id: 'u1',
      content: 'hola',
    });
  });

  it('encola mensajes mientras se conecta y los envía al abrir', () => {
    const { transport } = setup();
    transport.connect();
    transport.send({ type: 'user_message', id: 'u1', content: 'hola' });
    expect(last().sent).toHaveLength(0);
    last().open();
    expect(last().sent).toHaveLength(1);
  });

  it('lanza error si se envía sin conexión', () => {
    const { transport } = setup();
    expect(() => transport.send({ type: 'user_message', id: 'u1', content: 'x' })).toThrow(
      TransportNotConnectedError,
    );
  });

  it('emite eventos válidos e ignora los inválidos', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { transport, events } = setup();
    transport.connect();
    last().open();
    last().receive(JSON.stringify({ type: 'message_start', id: 'a1' }));
    last().receive('no es json');
    last().receive(JSON.stringify({ type: 'desconocido' }));
    last().receive(new ArrayBuffer(2));
    expect(events).toEqual([{ type: 'message_start', id: 'a1' }]);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('reintenta con backoff exponencial cuando se cae la conexión', () => {
    const { transport, statuses } = setup({ maxRetries: 2 });
    transport.connect();
    last().open();

    last().drop();
    expect(statuses.slice(-2)).toEqual(['closed', 'connecting']);
    vi.advanceTimersByTime(99);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    last().drop(); // falla el 1er reintento
    vi.advanceTimersByTime(200);
    expect(FakeWebSocket.instances).toHaveLength(3);

    last().drop(); // se agotan los reintentos
    expect(transport.status).toBe('error');
  });

  it('reinicia el contador de reintentos al reconectar', () => {
    const { transport } = setup({ maxRetries: 1 });
    transport.connect();
    last().open();
    last().drop();
    vi.advanceTimersByTime(100);
    last().open();
    expect(transport.status).toBe('open');
    last().drop();
    expect(transport.status).toBe('connecting');
  });

  it('no reintenta si reconnect es false', () => {
    const { transport } = setup({ reconnect: false });
    transport.connect();
    last().open();
    last().drop();
    expect(transport.status).toBe('error');
  });

  it('desconecta manualmente sin reintentar y descarta la cola', () => {
    const { transport } = setup();
    transport.connect();
    transport.send({ type: 'user_message', id: 'u1', content: 'x' });
    const socket = last();
    transport.disconnect();
    expect(transport.status).toBe('closed');
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    socket.open();
    expect(socket.sent).toHaveLength(0);
  });

  it('cancela un reintento pendiente al desconectar', () => {
    const { transport } = setup();
    transport.connect();
    last().drop();
    transport.disconnect();
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('ignora el cierre de un socket antiguo', () => {
    const { transport } = setup();
    transport.connect();
    const old = last();
    transport.disconnect();
    transport.connect();
    last().open();
    old.drop();
    expect(transport.status).toBe('open');
  });

  it('pasa a error si el constructor de WebSocket lanza', () => {
    const Throwing = function () {
      throw new Error('URL inválida');
    } as unknown as WebSocketFactory;
    const { transport } = setup({ WebSocketImpl: Throwing });
    transport.connect();
    expect(transport.status).toBe('error');
  });
});
