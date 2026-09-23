import { ChatIcon, CloseIcon } from '../icons/icons';

export interface ChatLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

/** Botón flotante que abre/cierra el chat. */
export function ChatLauncher({ isOpen, onToggle, unreadCount = 0 }: ChatLauncherProps) {
  return (
    <button
      type="button"
      className="agichat-launcher"
      aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      {isOpen ? <CloseIcon width={24} height={24} /> : <ChatIcon width={24} height={24} />}
      {!isOpen && unreadCount > 0 && (
        <span className="agichat-launcher__badge" aria-label={`${unreadCount} mensajes nuevos`}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
