import { formatTime } from '../../core/format';
import type { ChatMessage } from '../../core/types';
import { MarkdownContent } from '../MarkdownContent/MarkdownContent';
import { RetryIcon } from '../icons/icons';

export interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: (id: string) => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';

  return (
    <div
      className={`agichat-message agichat-message--${message.role}${isError ? ' agichat-message--error' : ''}`}
      data-testid={`message-${message.role}`}
      data-status={message.status}
    >
      {!isUser && (
        <div className="agichat-message__avatar" aria-hidden="true">
          AI
        </div>
      )}
      <div className="agichat-message__body">
        <div className="agichat-message__bubble">
          {isUser ? (
            <p className="agichat-message__text">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
          {isStreaming && <span className="agichat-cursor" aria-hidden="true" />}
        </div>
        <div className="agichat-message__meta">
          {isError ? (
            <>
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
            </>
          ) : (
            <time dateTime={new Date(message.createdAt).toISOString()}>
              {formatTime(message.createdAt)}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}
