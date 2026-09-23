/**
 * Tipos de dominio del chat. No dependen de React ni de ningún transporte,
 * por lo que pueden reutilizarse desde cualquier capa (UI, transportes, servidor mock).
 */

export type MessageRole = 'user' | 'assistant';

/**
 * Estado de vida de un mensaje:
 *  - `sending`:   mensaje del usuario enviado, aún sin respuesta del agente.
 *  - `streaming`: el agente está enviando la respuesta por fragmentos.
 *  - `done`:      mensaje completo.
 *  - `error`:     hubo un fallo al enviar o recibir el mensaje.
 */
export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  /** Contenido en Markdown (los mensajes del agente se renderizan como Markdown). */
  content: string;
  createdAt: number;
  status: MessageStatus;
}

/** Estado de la conexión con el backend (mock o agente real). */
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
