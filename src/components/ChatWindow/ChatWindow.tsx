import { STATUS_LABELS } from '../../core/format';
import type { UseChatResult } from '../../hooks/useChat';
import { Avatar } from '../Avatar/Avatar';
import { ChatInput } from '../ChatInput/ChatInput';
import { MessageList } from '../MessageList/MessageList';
import { WelcomeHero } from '../WelcomeHero/WelcomeHero';
import { CloseIcon, TrashIcon } from '../icons/icons';

export interface ChatWindowProps {
  chat: UseChatResult;
  assistantName: string;
  greeting: string;
  description?: string;
  avatarUrl?: string;
  placeholder?: string;
  suggestions?: string[];
  onClose?: () => void;
}

/**
 * Panel del chat según el wireframe: barra superior mínima, bienvenida centrada,
 * conversación y barra de entrada.
 */
export function ChatWindow({
  chat,
  assistantName,
  greeting,
  description,
  avatarUrl,
  placeholder,
  suggestions,
  onClose,
}: ChatWindowProps) {
  const { messages, isResponding, connection, error } = chat;

  return (
    <section className="agichat-window" role="dialog" aria-label={`Chat con ${assistantName}`}>
      <header className="agichat-header">
        <span className="agichat-header__avatar">
          <Avatar src={avatarUrl} size={34} />
          <span
            className={`agichat-status-dot agichat-status-dot--${connection}`}
            aria-hidden="true"
          />
        </span>
        <div className="agichat-header__info">
          <p className="agichat-header__name">{assistantName}</p>
          <p className="agichat-header__status" data-testid="connection-status">
            {STATUS_LABELS[connection]}
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
        intro={
          <WelcomeHero
            greeting={greeting}
            description={description}
            avatarUrl={avatarUrl}
            highlight={assistantName}
          />
        }
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
    </section>
  );
}
