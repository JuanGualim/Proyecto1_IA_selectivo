/**
 * API pública del SDK de AGIChat.
 * Todo lo que se exporte aquí se considera contrato público: cambiarlo es un breaking change.
 */
export { ChatWidget } from './components/ChatWidget/ChatWidget';
export type {
  ChatWidgetProps,
  ChatWidgetPosition,
  ChatWidgetTheme,
} from './components/ChatWidget/ChatWidget';
export { MarkdownContent } from './components/MarkdownContent/MarkdownContent';
export { useChat } from './hooks/useChat';
export type { UseChatResult } from './hooks/useChat';
export { mountChatWidget } from './sdk/mountChatWidget';
export type { MountOptions, MountedWidget } from './sdk/mountChatWidget';
export * from './transports';
export { parseServerEvent, parseClientEvent } from './core/protocol';
export type * from './core/protocol';
export type * from './core/types';
