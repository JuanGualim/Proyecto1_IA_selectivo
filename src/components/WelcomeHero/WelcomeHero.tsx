import { Avatar } from '../Avatar/Avatar';

export interface WelcomeHeroProps {
  greeting: string;
  description?: string;
  /** URL de la imagen del avatar. Si no se indica, se usa el avatar por defecto. */
  avatarUrl?: string;
  /** Texto del saludo que se resalta con el color principal (p. ej. el nombre del asistente). */
  highlight?: string;
}

function renderGreeting(greeting: string, highlight?: string) {
  const index = highlight ? greeting.indexOf(highlight) : -1;
  if (!highlight || index === -1) return greeting;
  return (
    <>
      {greeting.slice(0, index)}
      <span className="agichat-hero__highlight">{highlight}</span>
      {greeting.slice(index + highlight.length)}
    </>
  );
}

/** Bienvenida centrada al inicio de la conversación: avatar, saludo y descripción. */
export function WelcomeHero({ greeting, description, avatarUrl, highlight }: WelcomeHeroProps) {
  return (
    <div className="agichat-hero">
      <div className="agichat-hero__ring">
        <Avatar src={avatarUrl} size={100} className="agichat-hero__avatar" />
      </div>
      <h2 className="agichat-hero__title">{renderGreeting(greeting, highlight)}</h2>
      {description && <p className="agichat-hero__description">{description}</p>}
    </div>
  );
}
