import type { ConnectionStatus } from './types';

/** Textos visibles para cada estado de conexión. */
export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: 'Desconectado',
  connecting: 'Conectando…',
  open: 'En línea',
  closed: 'Desconectado',
  error: 'Sin conexión',
};

/** Formatea una marca de tiempo como `HH:MM`. */
export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}
