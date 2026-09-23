import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage } from '../../core/types';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import { TypingIndicator } from '../TypingIndicator/TypingIndicator';

export interface MessageListProps {
  messages: ChatMessage[];
  isResponding: boolean;
  /** Contenido fijo al inicio de la conversación (p. ej. la bienvenida). */
  intro?: ReactNode;
  suggestions?: string[];
  onSuggestion?: (text: string) => void;
  onRetry?: (id: string) => void;
}

export function MessageList({
  messages,
  isResponding,
  intro,
  suggestions = [],
  onSuggestion,
  onRetry,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  // El indicador se muestra mientras el agente "piensa" (antes de que llegue el primer fragmento).
  const showTyping = isResponding && last?.role !== 'assistant';

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, showTyping]);

  return (
    <div className="agichat-messages" role="log" aria-live="polite" aria-label="Mensajes">
      {intro}

      {messages.length === 0 && suggestions.length > 0 && (
        <div className="agichat-suggestions" aria-label="Sugerencias">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="agichat-suggestion"
              onClick={() => onSuggestion?.(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onRetry={onRetry} />
      ))}

      {showTyping && (
        <div className="agichat-message agichat-message--assistant">
          <TypingIndicator />
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
