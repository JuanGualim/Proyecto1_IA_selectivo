/**
 * Protocolo de mensajes entre el widget y el backend del agente.
 *
 * Es el contrato que debe respetar cualquier backend (el servidor mock de la fase 1
 * o el agente real de la fase 2). Se envía como JSON por WebSocket.
 *
 * IMPORTANTE: este archivo no debe tener imports de valores (solo `import type`),
 * porque el servidor mock lo importa directamente con Node (type stripping).
 */

/** Evento que el cliente (widget) envía al servidor. */
export interface UserMessageEvent {
  type: 'user_message';
  id: string;
  content: string;
}

export type ClientEvent = UserMessageEvent;

/** El agente empieza a responder. `id` identifica al mensaje de respuesta. */
export interface MessageStartEvent {
  type: 'message_start';
  id: string;
  /** Id del mensaje del usuario al que responde. */
  replyTo?: string;
}

/** Fragmento de texto (Markdown) de la respuesta en curso. */
export interface MessageDeltaEvent {
  type: 'message_delta';
  id: string;
  delta: string;
}

/** La respuesta terminó. */
export interface MessageEndEvent {
  type: 'message_end';
  id: string;
}

/** Error reportado por el servidor. */
export interface ErrorEvent {
  type: 'error';
  message: string;
  /** Id del mensaje afectado, si aplica. */
  id?: string;
}

export type ServerEvent = MessageStartEvent | MessageDeltaEvent | MessageEndEvent | ErrorEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Valida un valor desconocido (por ejemplo, JSON recibido por la red) y lo convierte
 * en un `ServerEvent`. Devuelve `null` si no cumple el protocolo.
 */
export function parseServerEvent(value: unknown): ServerEvent | null {
  if (!isRecord(value) || !isString(value.type)) return null;

  switch (value.type) {
    case 'message_start':
      if (!isString(value.id)) return null;
      return {
        type: 'message_start',
        id: value.id,
        ...(isString(value.replyTo) ? { replyTo: value.replyTo } : {}),
      };
    case 'message_delta':
      if (!isString(value.id) || !isString(value.delta)) return null;
      return { type: 'message_delta', id: value.id, delta: value.delta };
    case 'message_end':
      if (!isString(value.id)) return null;
      return { type: 'message_end', id: value.id };
    case 'error':
      if (!isString(value.message)) return null;
      return {
        type: 'error',
        message: value.message,
        ...(isString(value.id) ? { id: value.id } : {}),
      };
    default:
      return null;
  }
}

/** Valida un evento enviado por el cliente. Lo usa el servidor mock. */
export function parseClientEvent(value: unknown): ClientEvent | null {
  if (!isRecord(value)) return null;
  if (value.type !== 'user_message') return null;
  if (!isString(value.id) || !isString(value.content)) return null;
  return { type: 'user_message', id: value.id, content: value.content };
}

/** Parsea texto JSON de forma segura. */
export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
