import { useCallback, useEffect, useReducer } from 'react';
import { chatReducer, createInitialState, type ChatState } from '../core/chatReducer';
import { createId } from '../core/id';
import type { ChatMessage } from '../core/types';
import type { ChatTransport } from '../transports/ChatTransport';

export interface UseChatResult extends ChatState {
  /** Envía un mensaje del usuario. Ignora textos vacíos o envíos mientras el agente responde. */
  sendMessage: (content: string) => void;
  /** Reenvía el contenido de un mensaje que falló. */
  retry: (messageId: string) => void;
  /** Borra la conversación. */
  clear: () => void;
  dismissError: () => void;
}

/**
 * Hook que conecta la UI con un `ChatTransport`: gestiona la conexión,
 * traduce los eventos del protocolo a estado y expone acciones para la UI.
 */
export function useChat(
  transport: ChatTransport,
  initialMessages: ChatMessage[] = [],
): UseChatResult {
  const [state, dispatch] = useReducer(chatReducer, initialMessages, createInitialState);

  useEffect(() => {
    const offEvent = transport.subscribe((event) =>
      dispatch({ type: 'server_event', event, receivedAt: Date.now() }),
    );
    const offStatus = transport.onStatusChange((status) =>
      dispatch({ type: 'connection_changed', status }),
    );
    dispatch({ type: 'connection_changed', status: transport.status });
    transport.connect();
    return () => {
      offEvent();
      offStatus();
      transport.disconnect();
    };
  }, [transport]);

  const sendMessage = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || state.isResponding) return;

      const message: ChatMessage = {
        id: createId('msg'),
        role: 'user',
        content: text,
        createdAt: Date.now(),
        status: 'sending',
      };
      dispatch({ type: 'user_message', message });
      try {
        transport.send({ type: 'user_message', id: message.id, content: text });
      } catch (error) {
        dispatch({
          type: 'send_failed',
          id: message.id,
          error: error instanceof Error ? error.message : 'No se pudo enviar el mensaje.',
        });
      }
    },
    [transport, state.isResponding],
  );

  const retry = useCallback(
    (messageId: string) => {
      const failed = state.messages.find(
        (message) => message.id === messageId && message.role === 'user',
      );
      if (!failed || failed.status !== 'error' || state.isResponding) return;
      dispatch({ type: 'remove_message', id: failed.id });
      sendMessage(failed.content);
    },
    [state.messages, state.isResponding, sendMessage],
  );

  const clear = useCallback(() => dispatch({ type: 'reset' }), []);
  const dismissError = useCallback(() => dispatch({ type: 'dismiss_error' }), []);

  return { ...state, sendMessage, retry, clear, dismissError };
}
