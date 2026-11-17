import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { AttributionInfo } from '../../core/attribution';
import type { ChatMessage } from '../../core/types';
import { useChat } from '../../hooks/useChat';
import type { ChatTransport } from '../../transports/ChatTransport';
import { ChatLauncher } from '../ChatLauncher/ChatLauncher';
import { ChatWindow } from '../ChatWindow/ChatWindow';
import '../../styles/agichat.css';

export type ChatWidgetPosition = 'bottom-right' | 'bottom-left';
export type ChatWidgetTheme = 'light' | 'dark' | 'auto';

export interface ChatWidgetProps {
  /** Adaptador de comunicación con el agente (mock, WebSocket o uno propio). */
  transport: ChatTransport;
  /** Nombre del asistente, visible en la barra superior y en el saludo. */
  assistantName?: string;
  /** Saludo principal de la bienvenida. Por defecto: "¡Hola soy tu asistente virtual <nombre>!". */
  greeting?: string;
  /** Texto bajo el saludo. */
  description?: string;
  /** Imagen del avatar de la bienvenida. Por defecto, un osito ilustrado. */
  avatarUrl?: string;
  placeholder?: string;
  /** Sugerencias rápidas que se muestran cuando la conversación está vacía. */
  suggestions?: string[];
  position?: ChatWidgetPosition;
  theme?: ChatWidgetTheme;
  /** Color principal (cualquier color CSS válido). */
  primaryColor?: string;
  defaultOpen?: boolean;
  /** `floating` muestra el botón flotante; `inline` renderiza la ventana embebida en su contenedor. */
  mode?: 'floating' | 'inline';
  initialMessages?: ChatMessage[];
  /** Pie con la atribución del proveedor de datos, p. ej. `TMDB_ATTRIBUTION`. */
  attribution?: AttributionInfo;
  /**
   * Abre los sitios de referencia que pide el agente (evento `open_url`). Debe devolver
   * `false` si no pudo abrirlos. Por defecto abre una pestaña nueva con `window.open`.
   */
  openUrl?: (url: string) => boolean;
  onOpenChange?: (open: boolean) => void;
}

function countAssistantReplies(messages: ChatMessage[]): number {
  return messages.filter((message) => message.role === 'assistant' && message.status === 'done')
    .length;
}

/** Componente raíz del SDK: botón flotante + ventana de chat. */
export function ChatWidget({
  transport,
  assistantName = 'Sofía',
  greeting,
  description = 'Escribe una duda y yo te ayudaré en lo que pueda',
  avatarUrl,
  placeholder,
  suggestions,
  position = 'bottom-right',
  theme = 'light',
  primaryColor,
  defaultOpen = false,
  mode = 'floating',
  initialMessages,
  attribution,
  openUrl,
  onOpenChange,
}: ChatWidgetProps) {
  const chat = useChat(transport, initialMessages, { openUrl });
  const [isOpen, setIsOpen] = useState(defaultOpen || mode === 'inline');
  const [seenReplies, setSeenReplies] = useState(0);
  const replies = countAssistantReplies(chat.messages);
  const unread = isOpen ? 0 : Math.max(0, replies - seenReplies);

  const setOpen = (open: boolean) => {
    // Al abrir o cerrar se marcan como vistas todas las respuestas actuales.
    setSeenReplies(replies);
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && isOpen && mode === 'floating') setOpen(false);
  };

  // El segundo tono del degradado se deriva del color elegido para mantener la armonía.
  const style = primaryColor
    ? ({
        '--agichat-primary': primaryColor,
        '--agichat-primary-2': `color-mix(in srgb, ${primaryColor} 65%, #ffffff)`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={`agichat-root agichat-root--${mode} agichat-root--${position}`}
      data-theme={theme}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {isOpen && (
        <ChatWindow
          chat={chat}
          assistantName={assistantName}
          greeting={greeting ?? `¡Hola soy tu asistente virtual ${assistantName}!`}
          description={description}
          avatarUrl={avatarUrl}
          placeholder={placeholder}
          suggestions={suggestions}
          attribution={attribution}
          onClose={mode === 'floating' ? () => setOpen(false) : undefined}
        />
      )}
      {mode === 'floating' && (
        <ChatLauncher isOpen={isOpen} onToggle={() => setOpen(!isOpen)} unreadCount={unread} />
      )}
    </div>
  );
}
