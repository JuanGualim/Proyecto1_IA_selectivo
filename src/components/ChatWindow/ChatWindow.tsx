import { STATUS_LABELS } from '../../core/format';
import type { UseChatResult } from '../../hooks/useChat';
import { ChatInput } from '../ChatInput/ChatInput';
import { MessageList } from '../MessageList/MessageList';
import { CloseIcon, SparkIcon, TrashIcon } from '../icons/icons';

export interface ChatWindowProps {
  chat: UseChatResult;
  title: string;
  subtitle?: string;
  welcomeMessage?: string;
  placeholder?: string;
  suggestions?: string[];
  onClose?: () => void;
}

export function ChatWindow({
  chat,
  title,
  subtitle,
  welcomeMessage,
  placeholder,
  suggestions,
  onClose,
}: ChatWindowProps) {
  const { messages, isResponding, connection, error } = chat;

  return (
    <section className="agichat-window" role="dialog" aria-label={title}>
      <header className="agichat-header">
        <div className="agichat-header__avatar" aria-hidden="true">
          <SparkIcon />
        </div>
        <div className="agichat-header__info">
          <h2 className="agichat-header__title">{title}</h2>
          <p className="agichat-header__subtitle">
            <span
              className={`agichat-status-dot agichat-status-dot--${connection}`}
              aria-hidden="true"
            />
            <span data-testid="connection-status">{STATUS_LABELS[connection]}</span>
            {subtitle && <span className="agichat-header__sep"> · {subtitle}</span>}
          </p>
        </div>
        <button
          type="button"
          className="agichat-icon-button"
          aria-label="Borrar conversación"
          title="Borrar conversación"
          onClick={chat.clear}
          disabled={messages.length === 0 || isResponding}
        >
          <TrashIcon width={18} height={18} />
        </button>
        {onClose && (
          <button
            type="button"
            className="agichat-icon-button"
            aria-label="Cerrar chat"
            title="Cerrar"
            onClick={onClose}
          >
            <CloseIcon width={18} height={18} />
          </button>
        )}
      </header>

      <MessageList
        messages={messages}
        isResponding={isResponding}
        welcomeMessage={welcomeMessage}
        suggestions={suggestions}
        onSuggestion={chat.sendMessage}
        onRetry={chat.retry}
      />

      {error && (
        <div className="agichat-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="agichat-error__dismiss"
            aria-label="Descartar error"
            onClick={chat.dismissError}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      )}

      <ChatInput onSend={chat.sendMessage} disabled={isResponding} placeholder={placeholder} />
      <p className="agichat-footer">
        Impulsado por <strong>AGIChat</strong>
      </p>
    </section>
  );
}
