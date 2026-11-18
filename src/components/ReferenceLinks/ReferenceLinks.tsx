import type { MessageLink } from '../../core/types';
import { ExternalLinkIcon } from '../icons/icons';

export interface ReferenceLinksProps {
  links?: MessageLink[];
}

const STATUS_TEXT: Record<MessageLink['status'], string> = {
  pending: 'Abriendo',
  opened: 'Abrí en una pestaña nueva',
  blocked: 'Tu navegador bloqueó la pestaña. Ábrela aquí',
};

/**
 * Sitios de referencia (IMDb, Google Books) que el agente abrió en una pestaña nueva.
 * Siempre quedan como enlace por si el navegador bloqueó la ventana emergente.
 */
export function ReferenceLinks({ links = [] }: ReferenceLinksProps) {
  if (links.length === 0) return null;
  return (
    <ul className="agichat-links" aria-label="Sitios abiertos por el agente">
      {links.map((link) => (
        <li key={link.url} className={`agichat-links__item agichat-links__item--${link.status}`}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon width={14} height={14} />
            <span>
              {STATUS_TEXT[link.status]}: <strong>{link.label}</strong>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
