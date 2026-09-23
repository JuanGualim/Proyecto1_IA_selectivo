import type { ServerEvent } from '../core/protocol';
import { TransportNotConnectedError } from './ChatTransport';
import { MockTransport } from './MockTransport';

function setup(options: ConstructorParameters<typeof MockTransport>[0] = {}) {
  const transport = new MockTransport({
    connectDelayMs: 10,
    latencyMs: 100,
    chunkDelayMs: 5,
    ...options,
  });
  const events: ServerEvent[] = [];
  const statuses: string[] = [];
  transport.subscribe((event) => events.push(event));
  transport.onStatusChange((status) => statuses.push(status));
  return { transport, events, statuses };
}

describe('MockTransport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('simula la conexión', () => {
    const { transport, statuses } = setup();
    expect(transport.status).toBe('idle');
    transport.connect();
    transport.connect(); // idempotente
    expect(transport.status).toBe('connecting');
    vi.advanceTimersByTime(10);
    expect(transport.status).toBe('open');
    transport.connect();
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('lanza error si se envía sin conexión', () => {
    const { transport } = setup();
    expect(() => transport.send({ type: 'user_message', id: 'u1', content: 'hola' })).toThrow(
      TransportNotConnectedError,
    );
  });

  it('emite la respuesta en streaming siguiendo el protocolo', () => {
    const { transport, events } = setup({ responder: () => ({ content: 'uno dos tres' }) });
    transport.connect();
    vi.advanceTimersByTime(10);
    transport.send({ type: 'user_message', id: 'u1', content: 'hola' });

    vi.advanceTimersByTime(99);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1000);

    expect(events[0]).toMatchObject({ type: 'message_start', replyTo: 'u1' });
    const deltas = events.filter((e) => e.type === 'message_delta');
    expect(deltas.map((e) => (e.type === 'message_delta' ? e.delta : '')).join('')).toBe(
      'uno dos tres',
    );
    expect(events.at(-1)?.type).toBe('message_end');
    const ids = new Set(events.map((e) => ('id' in e ? e.id : undefined)));
    expect(ids.size).toBe(1);
  });

  it('emite un error cuando el responder falla', () => {
    const { transport, events } = setup({ responder: () => ({ error: 'boom' }) });
    transport.connect();
    vi.advanceTimersByTime(10);
    transport.send({ type: 'user_message', id: 'u1', content: 'x' });
    vi.advanceTimersByTime(100);
    expect(events).toEqual([{ type: 'error', message: 'boom', id: 'u1' }]);
  });

  it('cancela respuestas pendientes al desconectar', () => {
    const { transport, events } = setup();
    transport.connect();
    vi.advanceTimersByTime(10);
    transport.send({ type: 'user_message', id: 'u1', content: 'hola' });
    transport.disconnect();
    vi.advanceTimersByTime(10_000);
    expect(events).toHaveLength(0);
    expect(transport.status).toBe('closed');
  });

  it('permite reconectar después de desconectar', () => {
    const { transport } = setup();
    transport.connect();
    transport.disconnect();
    transport.connect();
    vi.advanceTimersByTime(10);
    expect(transport.status).toBe('open');
  });

  it('usa valores por defecto y deja de notificar a listeners desuscritos', () => {
    const transport = new MockTransport();
    const listener = vi.fn();
    const off = transport.onStatusChange(listener);
    const offEvents = transport.subscribe(listener);
    off();
    offEvents();
    transport.connect();
    vi.advanceTimersByTime(1000);
    expect(transport.status).toBe('open');
    expect(listener).not.toHaveBeenCalled();
  });
});
