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
export { useChat, openInNewTab } from './hooks/useChat';
export type { UseChatResult, UseChatOptions } from './hooks/useChat';
export { TMDB_ATTRIBUTION } from './core/attribution';
export type { AttributionInfo } from './core/attribution';
export { isAllowedReferenceUrl, buildReferenceLink } from './core/references';
export { isAllowedImageUrl, DEFAULT_IMAGE_HOSTS } from './core/media';
export { mountChatWidget } from './sdk/mountChatWidget';
export type { MountOptions, MountedWidget } from './sdk/mountChatWidget';
export * from './transports';
export { parseServerEvent, parseClientEvent } from './core/protocol';
export type * from './core/protocol';
export type * from './core/types';
