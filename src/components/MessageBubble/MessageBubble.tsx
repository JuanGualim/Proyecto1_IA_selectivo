import { formatTime } from '../../core/format';
import type { ChatMessage } from '../../core/types';
import { MarkdownContent } from '../MarkdownContent/MarkdownContent';
import { RetryIcon } from '../icons/icons';

export interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: (id: string) => void;
}

/**
 * Mensaje de la conversación (según el wireframe):
 *  - usuario: píldora con borde alineada a la derecha, texto plano;
 *  - agente: texto Markdown a todo el ancho, sin burbuja ni avatar.
 * La hora se muestra al pasar el cursor (atributo `title`).
 */
export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';

  return (
    <div
      className={`agichat-message agichat-message--${message.role}${isError ? ' agichat-message--error' : ''}`}
      data-testid={`message-${message.role}`}
      data-status={message.status}
      title={formatTime(message.createdAt)}
    >
      <div className="agichat-message__bubble">
        {isUser ? (
          <p className="agichat-message__text">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {isStreaming && <span className="agichat-cursor" aria-hidden="true" />}
      </div>
      {isError && (
        <div className="agichat-message__meta">
          <span className="agichat-message__status">No enviado</span>
          {isUser && onRetry && (
            <button
              type="button"
              className="agichat-message__retry"
              onClick={() => onRetry(message.id)}
            >
              <RetryIcon width={12} height={12} /> Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
