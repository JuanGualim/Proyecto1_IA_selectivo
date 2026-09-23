import type { ServerEvent } from './protocol';
import type { ChatMessage, ConnectionStatus } from './types';

/**
 * Estado del chat y reducer puro que lo actualiza.
 * Toda la lógica de negocio del chat vive aquí para poder probarla sin React ni red.
 */
export interface ChatState {
  messages: ChatMessage[];
  /** `true` mientras se espera o se recibe una respuesta del agente. */
  isResponding: boolean;
  connection: ConnectionStatus;
  /** Último error visible para el usuario. */
  error: string | null;
}

export type ChatAction =
  | { type: 'user_message'; message: ChatMessage }
  | { type: 'server_event'; event: ServerEvent; receivedAt: number }
  | { type: 'connection_changed'; status: ConnectionStatus }
  | { type: 'send_failed'; id: string; error: string }
  | { type: 'remove_message'; id: string }
  | { type: 'dismiss_error' }
  | { type: 'reset' };

export const CONNECTION_LOST_ERROR = 'Se perdió la conexión con el agente.';

export function createInitialState(messages: ChatMessage[] = []): ChatState {
  return { messages, isResponding: false, connection: 'idle', error: null };
}

function updateMessage(
  messages: ChatMessage[],
  id: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) => (message.id === id ? update(message) : message));
}

/** Marca como `error` los mensajes que quedaron pendientes (enviando o en streaming). */
function failPending(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) =>
    message.status === 'sending' || message.status === 'streaming'
      ? { ...message, status: 'error' }
      : message,
  );
}

function markSendingAsDone(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) =>
    message.status === 'sending' ? { ...message, status: 'done' } : message,
  );
}

function reduceServerEvent(state: ChatState, event: ServerEvent, receivedAt: number): ChatState {
  switch (event.type) {
    case 'message_start': {
      const messages = markSendingAsDone(state.messages);
      if (messages.some((message) => message.id === event.id)) {
        return { ...state, messages, isResponding: true };
      }
      return {
        ...state,
        isResponding: true,
        messages: [
          ...messages,
          {
            id: event.id,
            role: 'assistant',
            content: '',
            createdAt: receivedAt,
            status: 'streaming',
          },
        ],
      };
    }
    case 'message_delta': {
      const exists = state.messages.some((message) => message.id === event.id);
      if (!exists) {
        // Tolerante: si el servidor omitió `message_start`, se crea el mensaje.
        return reduceServerEvent(
          reduceServerEvent(state, { type: 'message_start', id: event.id }, receivedAt),
          event,
          receivedAt,
        );
      }
      return {
        ...state,
        messages: updateMessage(state.messages, event.id, (message) => ({
          ...message,
          content: message.content + event.delta,
        })),
      };
    }
    case 'message_end':
      return {
        ...state,
        isResponding: false,
        messages: updateMessage(state.messages, event.id, (message) => ({
          ...message,
          status: 'done',
        })),
      };
    case 'error': {
      const targetExists =
        event.id !== undefined && state.messages.some((message) => message.id === event.id);
      return {
        ...state,
        isResponding: false,
        error: event.message,
        messages: targetExists
          ? updateMessage(state.messages, event.id as string, (message) => ({
              ...message,
              status: 'error',
            }))
          : failPending(state.messages),
      };
    }
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'user_message':
      return {
        ...state,
        error: null,
        isResponding: true,
        messages: [...state.messages, action.message],
      };
    case 'server_event':
      return reduceServerEvent(state, action.event, action.receivedAt);
    case 'connection_changed': {
      const lost = action.status === 'closed' || action.status === 'error';
      if (lost && state.isResponding) {
        return {
          ...state,
          connection: action.status,
          isResponding: false,
          error: CONNECTION_LOST_ERROR,
          messages: failPending(state.messages),
        };
      }
      return { ...state, connection: action.status };
    }
    case 'send_failed':
      return {
        ...state,
        isResponding: false,
        error: action.error,
        messages: updateMessage(state.messages, action.id, (message) => ({
          ...message,
          status: 'error',
        })),
      };
    case 'remove_message':
      return { ...state, messages: state.messages.filter((message) => message.id !== action.id) };
    case 'dismiss_error':
      return { ...state, error: null };
    case 'reset':
      return { ...createInitialState(), connection: state.connection };
  }
}
