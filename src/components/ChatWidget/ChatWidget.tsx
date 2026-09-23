import { useState, type CSSProperties, type KeyboardEvent } from 'react';
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
  title?: string;
  subtitle?: string;
  /** Mensaje de bienvenida en Markdown, siempre visible al inicio de la conversación. */
  welcomeMessage?: string;
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
  onOpenChange?: (open: boolean) => void;
}

function countAssistantReplies(messages: ChatMessage[]): number {
  return messages.filter((message) => message.role === 'assistant' && message.status === 'done')
    .length;
}

/** Componente raíz del SDK: botón flotante + ventana de chat. */
export function ChatWidget({
  transport,
  title = 'AGIChat',
  subtitle = 'Asistente virtual',
  welcomeMessage = '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
  placeholder,
  suggestions,
  position = 'bottom-right',
  theme = 'light',
  primaryColor,
  defaultOpen = false,
  mode = 'floating',
  initialMessages,
  onOpenChange,
}: ChatWidgetProps) {
  const chat = useChat(transport, initialMessages);
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

  const style = primaryColor ? ({ '--agichat-primary': primaryColor } as CSSProperties) : undefined;

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
          title={title}
          subtitle={subtitle}
          welcomeMessage={welcomeMessage}
          placeholder={placeholder}
          suggestions={suggestions}
          onClose={mode === 'floating' ? () => setOpen(false) : undefined}
        />
      )}
      {mode === 'floating' && (
        <ChatLauncher isOpen={isOpen} onToggle={() => setOpen(!isOpen)} unreadCount={unread} />
      )}
    </div>
  );
}
