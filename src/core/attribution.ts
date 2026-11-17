/**
 * Atribución que se muestra al pie del widget (p. ej. la fuente de los datos del agente).
 */
export interface AttributionInfo {
  /** Aviso legal visible. */
  text: string;
  logoUrl?: string;
  logoAlt?: string;
  /** Sitio del proveedor de datos. */
  href?: string;
}

/**
 * Atribución exigida por los términos de uso de la API de TMDB (sección 3): su logo, menos
 * prominente que la marca de la aplicación, y el aviso de que TMDB no respalda el producto.
 * Logo oficial "Alt short (blue)" de https://www.themoviedb.org/about/logos-attribution
 */
export const TMDB_ATTRIBUTION: AttributionInfo = {
  text: 'This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
  logoUrl:
    'https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg',
  logoAlt: 'The Movie Database (TMDB)',
  href: 'https://www.themoviedb.org/',
};
