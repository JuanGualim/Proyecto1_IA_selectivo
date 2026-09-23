import { createTransport } from './createTransport';
import { MockTransport } from './MockTransport';
import { WebSocketTransport } from './WebSocketTransport';

describe('createTransport', () => {
  it('crea un MockTransport', () => {
    expect(createTransport({ type: 'mock', latencyMs: 1 })).toBeInstanceOf(MockTransport);
  });

  it('crea un WebSocketTransport', () => {
    expect(createTransport({ type: 'websocket', url: 'ws://localhost:1' })).toBeInstanceOf(
      WebSocketTransport,
    );
  });
});
