import { BearAvatarIcon } from '../icons/icons';

export interface WelcomeHeroProps {
  greeting: string;
  description?: string;
  /** URL de la imagen del avatar. Si no se indica, se usa el avatar por defecto. */
  avatarUrl?: string;
}

/** Bienvenida centrada al inicio de la conversación: avatar, saludo y descripción. */
export function WelcomeHero({ greeting, description, avatarUrl }: WelcomeHeroProps) {
  return (
    <div className="agichat-hero">
      <div className="agichat-hero__avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="agichat-hero__image" />
        ) : (
          <BearAvatarIcon width={64} height={64} data-testid="default-avatar" />
        )}
      </div>
      <h2 className="agichat-hero__title">{greeting}</h2>
      {description && <p className="agichat-hero__description">{description}</p>}
    </div>
  );
}
