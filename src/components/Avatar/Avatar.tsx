import { BearAvatarIcon } from '../icons/icons';

export interface AvatarProps {
  /** URL de la imagen. Si no se indica, se usa el osito por defecto. */
  src?: string;
  /** Tamaño en píxeles. */
  size: number;
  className?: string;
}

/** Avatar circular del asistente, usado en la barra superior y en la bienvenida. */
export function Avatar({ src, size, className = '' }: AvatarProps) {
  return (
    <span
      className={`agichat-avatar ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className="agichat-avatar__image" />
      ) : (
        <BearAvatarIcon
          width={Math.round(size * 0.64)}
          height={Math.round(size * 0.64)}
          data-testid="default-avatar"
        />
      )}
    </span>
  );
}
