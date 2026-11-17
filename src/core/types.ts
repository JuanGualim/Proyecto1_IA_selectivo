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

/**
 * Enlace de referencia que el agente abrió (o intentó abrir) en una pestaña nueva:
 *  - `pending`: recibido, aún sin abrir.
 *  - `opened`:  la pestaña se abrió.
 *  - `blocked`: el navegador bloqueó la ventana emergente; el usuario puede abrirlo con un clic.
 */
export type LinkStatus = 'pending' | 'opened' | 'blocked';

export interface MessageLink {
  url: string;
  label: string;
  status: LinkStatus;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  /** Contenido en Markdown (los mensajes del agente se renderizan como Markdown). */
  content: string;
  createdAt: number;
  status: MessageStatus;
  /** Sitios de referencia abiertos por el agente para este mensaje. */
  links?: MessageLink[];
}

/** Estado de la conexión con el backend (mock o agente real). */
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
