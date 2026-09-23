import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

export function RetryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Avatar por defecto del asistente (osito), inspirado en el wireframe. */
export function BearAvatarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable={false} {...props}>
      <circle cx="16" cy="16" r="9" fill="currentColor" />
      <circle cx="48" cy="16" r="9" fill="currentColor" />
      <circle cx="16" cy="16" r="4" fill="var(--agichat-bg)" opacity="0.35" />
      <circle cx="48" cy="16" r="4" fill="var(--agichat-bg)" opacity="0.35" />
      <ellipse cx="32" cy="35" rx="22" ry="20" fill="currentColor" />
      <circle cx="24" cy="31" r="3" fill="var(--agichat-bg)" />
      <circle cx="40" cy="31" r="3" fill="var(--agichat-bg)" />
      <ellipse cx="32" cy="43" rx="9" ry="7" fill="var(--agichat-bg)" />
      <ellipse cx="32" cy="40.5" rx="3.5" ry="2.5" fill="currentColor" />
    </svg>
  );
}
