/**
 * Sitios de referencia que el agente puede abrir en una pestaña del navegador.
 *
 * Es la única fuente de verdad de la lista permitida: la usan el servidor MCP de navegación
 * (que construye las URLs) y el widget (que vuelve a validarlas antes de abrirlas).
 * Las URLs se construyen a partir de identificadores validados, nunca se aceptan URLs
 * arbitrarias del modelo: así un prompt injection no puede abrir sitios maliciosos.
 *
 * IMPORTANTE: sin imports de valores, porque Node lo ejecuta directamente (type stripping).
 */

export type ReferenceSite = 'imdb' | 'google_books';

export interface ReferenceRequest {
  site: ReferenceSite;
  /** Id de IMDb (`tt0000000`) o de volumen de Google Books. */
  id?: string;
  /** Texto a buscar si no se conoce el id. */
  query?: string;
}

export interface ReferenceLink {
  site: ReferenceSite;
  url: string;
  label: string;
}

const IMDB_ID = /^tt\d{5,10}$/;
const BOOKS_ID = /^[\w-]{4,40}$/;
const MAX_QUERY = 120;

/** Hosts y rutas permitidos. */
const ALLOWED: Array<{ host: string; path: RegExp; check?: (url: URL) => boolean }> = [
  { host: 'www.imdb.com', path: /^\/(title\/tt\d{5,10}\/?|find\/?)$/ },
  { host: 'books.google.com', path: /^\/books$/ },
  // En google.com solo se permite la búsqueda de libros (tbm=bks), no la búsqueda general.
  {
    host: 'www.google.com',
    path: /^\/search$/,
    check: (url) => url.searchParams.get('tbm') === 'bks',
  },
];

function cleanQuery(query: string | undefined): string | null {
  const text = query
    ?.replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, MAX_QUERY) : null;
}

/** Construye la URL de referencia o devuelve `null` si los datos no son válidos. */
export function buildReferenceLink(request: ReferenceRequest): ReferenceLink | null {
  const query = cleanQuery(request.query);
  if (request.site === 'imdb') {
    if (request.id && IMDB_ID.test(request.id)) {
      return { site: 'imdb', url: `https://www.imdb.com/title/${request.id}/`, label: 'IMDb' };
    }
    if (query) {
      return {
        site: 'imdb',
        url: `https://www.imdb.com/find/?q=${encodeURIComponent(query)}&s=tt`,
        label: `IMDb: ${query}`,
      };
    }
    return null;
  }
  if (request.site === 'google_books') {
    if (request.id && BOOKS_ID.test(request.id)) {
      return {
        site: 'google_books',
        url: `https://books.google.com/books?id=${encodeURIComponent(request.id)}`,
        label: 'Google Books',
      };
    }
    if (query) {
      return {
        site: 'google_books',
        url: `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(query)}`,
        label: `Google Books: ${query}`,
      };
    }
  }
  return null;
}

/** Verifica que una URL apunte a un sitio de referencia permitido (HTTPS, host y ruta). */
export function isAllowedReferenceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return ALLOWED.some(
    ({ host, path, check }) =>
      url.hostname === host && path.test(url.pathname) && (check?.(url) ?? true),
  );
}
