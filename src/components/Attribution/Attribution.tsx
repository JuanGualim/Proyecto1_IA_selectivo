import type { AttributionInfo } from '../../core/attribution';

export interface AttributionProps {
  attribution: AttributionInfo;
}

/** Pie del widget con el logo y el aviso del proveedor de datos (p. ej. TMDB). */
export function Attribution({ attribution }: AttributionProps) {
  const { text, logoUrl, logoAlt, href } = attribution;
  const logo = logoUrl ? (
    <img className="agichat-attribution__logo" src={logoUrl} alt={logoAlt ?? ''} />
  ) : null;

  return (
    <footer className="agichat-attribution">
      {logo &&
        (href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {logo}
          </a>
        ) : (
          logo
        ))}
      <small className="agichat-attribution__text">{text}</small>
    </footer>
  );
}
