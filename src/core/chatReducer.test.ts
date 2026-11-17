import {
  CONNECTION_LOST_ERROR,
  chatReducer,
  createInitialState,
  type ChatState,
} from './chatReducer';
import type { ServerEvent } from './protocol';
import type { ChatMessage } from './types';

const userMessage = (id = 'u1', content = 'hola'): ChatMessage => ({
  id,
  role: 'user',
  content,
  createdAt: 1,
  status: 'sending',
});

function withUserMessage(): ChatState {
  return chatReducer(createInitialState(), { type: 'user_message', message: userMessage() });
}

const server = (state: ChatState, event: ServerEvent) =>
  chatReducer(state, { type: 'server_event', event, receivedAt: 100 });

describe('chatReducer', () => {
  it('crea el estado inicial', () => {
    expect(createInitialState()).toEqual({
      messages: [],
      isResponding: false,
      connection: 'idle',
      error: null,
    });
  });

  it('agrega el mensaje del usuario y marca que el agente responde', () => {
    const state = withUserMessage();
    expect(state.messages).toHaveLength(1);
    expect(state.isResponding).toBe(true);
    expect(state.error).toBeNull();
  });

  it('procesa el ciclo start → delta → end', () => {
    let state = withUserMessage();
    state = server(state, { type: 'message_start', id: 'a1' });
    expect(state.messages[0]?.status).toBe('done');
    expect(state.messages[1]).toMatchObject({ id: 'a1', role: 'assistant', status: 'streaming' });

    state = server(state, { type: 'message_delta', id: 'a1', delta: 'Hola ' });
    state = server(state, { type: 'message_delta', id: 'a1', delta: '**mundo**' });
    expect(state.messages[1]?.content).toBe('Hola **mundo**');

    state = server(state, { type: 'message_end', id: 'a1' });
    expect(state.messages[1]?.status).toBe('done');
    expect(state.isResponding).toBe(false);
  });

  it('ignora un message_start duplicado', () => {
    let state = server(withUserMessage(), { type: 'message_start', id: 'a1' });
    state = server(state, { type: 'message_start', id: 'a1' });
    expect(state.messages).toHaveLength(2);
    expect(state.isResponding).toBe(true);
  });

  it('crea el mensaje si llega un delta sin start', () => {
    const state = server(withUserMessage(), { type: 'message_delta', id: 'a1', delta: 'x' });
    expect(state.messages[1]).toMatchObject({ id: 'a1', content: 'x', status: 'streaming' });
  });

  it('marca como error el mensaje indicado por el servidor', () => {
    const state = server(withUserMessage(), { type: 'error', message: 'falló', id: 'u1' });
    expect(state.messages[0]?.status).toBe('error');
    expect(state.error).toBe('falló');
    expect(state.isResponding).toBe(false);
  });

  it('marca como error los pendientes si el error no tiene id conocido', () => {
    let state = server(withUserMessage(), { type: 'message_start', id: 'a1' });
    state = chatReducer(state, { type: 'user_message', message: userMessage('u2') });
    state = server(state, { type: 'error', message: 'falló', id: 'desconocido' });
    expect(state.messages.map((m) => m.status)).toEqual(['done', 'error', 'error']);
  });

  it('falla los pendientes si se pierde la conexión mientras responde', () => {
    const state = chatReducer(withUserMessage(), { type: 'connection_changed', status: 'closed' });
    expect(state.connection).toBe('closed');
    expect(state.error).toBe(CONNECTION_LOST_ERROR);
    expect(state.messages[0]?.status).toBe('error');
    expect(state.isResponding).toBe(false);
  });

  it('solo actualiza la conexión si no hay respuesta en curso', () => {
    const state = chatReducer(createInitialState(), {
      type: 'connection_changed',
      status: 'error',
    });
    expect(state.connection).toBe('error');
    expect(state.error).toBeNull();
  });

  it('marca un envío fallido', () => {
    const state = chatReducer(withUserMessage(), { type: 'send_failed', id: 'u1', error: 'x' });
    expect(state.messages[0]?.status).toBe('error');
    expect(state.error).toBe('x');
    expect(state.isResponding).toBe(false);
  });

  it('elimina un mensaje', () => {
    const state = chatReducer(withUserMessage(), { type: 'remove_message', id: 'u1' });
    expect(state.messages).toHaveLength(0);
  });

  it('descarta el error', () => {
    const failed = chatReducer(withUserMessage(), { type: 'send_failed', id: 'u1', error: 'x' });
    expect(chatReducer(failed, { type: 'dismiss_error' }).error).toBeNull();
  });

  it('reinicia la conversación conservando el estado de conexión', () => {
    let state = chatReducer(withUserMessage(), { type: 'connection_changed', status: 'open' });
    state = chatReducer(state, { type: 'reset' });
    expect(state).toEqual({ ...createInitialState(), connection: 'open' });
  });

  describe('open_url', () => {
    const IMDB = 'https://www.imdb.com/title/tt1160419/';

    function withReply(): ChatState {
      return server(withUserMessage(), { type: 'message_start', id: 'a1' });
    }

    it('agrega el enlace pendiente al mensaje de respuesta', () => {
      const state = server(withReply(), { type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' });
      expect(state.messages[1]?.links).toEqual([{ url: IMDB, label: 'IMDb', status: 'pending' }]);
    });

    it('marca como abierto si el servidor ya abrió la pestaña', () => {
      const state = server(withReply(), {
        type: 'open_url',
        id: 'a1',
        url: IMDB,
        label: 'IMDb',
        openedByServer: true,
      });
      expect(state.messages[1]?.links?.[0]?.status).toBe('opened');
    });

    it('ignora URLs fuera de la lista, mensajes inexistentes y duplicados', () => {
      const base = withReply();
      expect(
        server(base, { type: 'open_url', id: 'a1', url: 'https://evil.test/', label: 'x' }),
      ).toBe(base);
      expect(server(base, { type: 'open_url', id: 'nope', url: IMDB, label: 'x' })).toBe(base);
      const once = server(base, { type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' });
      expect(server(once, { type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' })).toBe(once);
    });

    it('actualiza el estado del enlace tras intentar abrirlo', () => {
      const state = server(withReply(), { type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' });
      const blocked = chatReducer(state, {
        type: 'link_status',
        messageId: 'a1',
        url: IMDB,
        status: 'blocked',
      });
      expect(blocked.messages[1]?.links?.[0]?.status).toBe('blocked');
      const other = chatReducer(state, {
        type: 'link_status',
        messageId: 'u1',
        url: IMDB,
        status: 'opened',
      });
      expect(other.messages[0]?.links).toBeUndefined();
    });
  });
});
