/**
 * Dominios desde los que el widget muestra imágenes del agente (pósters de TMDB y portadas
 * de Google Books). Una imagen Markdown hacia cualquier otro dominio podría usarse para
 * exfiltrar datos en la URL (el navegador la pediría automáticamente), por eso se bloquea.
 */
export const DEFAULT_IMAGE_HOSTS: readonly string[] = [
  'image.tmdb.org',
  'books.google.com',
  'books.googleusercontent.com',
];

export function isAllowedImageUrl(
  value: string | undefined,
  hosts: readonly string[] = DEFAULT_IMAGE_HOSTS,
): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}
