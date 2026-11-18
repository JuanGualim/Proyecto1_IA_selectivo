import { isAllowedReferenceUrl, type ReferenceSite } from '../../src/core/references.ts';

/**
 * Estado de un turno de conversación compartido por el supervisor y los especialistas.
 * Acumula, a partir de los datos ESTRUCTURADOS de las herramientas (no del texto del modelo),
 * las películas consultadas y las acciones para el widget.
 */

export interface MovieCard {
  id: number;
  title: string;
  year: number | null;
  rating: number | null;
  posterUrl: string | null;
  tmdbUrl: string | null;
  imdbUrl: string | null;
  basedOnBook: boolean | null;
}

export interface OpenUrlAction {
  site: ReferenceSite;
  url: string;
  label: string;
  /** El servidor MCP ya abrió la pestaña en la máquina anfitriona. */
  openedOnHost: boolean;
}

/** Máximo de pestañas que el agente puede abrir por mensaje (agencia limitada). */
export const MAX_OPEN_ACTIONS = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown) => (typeof value === 'string' && value ? value : null);
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function toMovieCard(value: unknown): MovieCard | null {
  if (!isRecord(value)) return null;
  const id = num(value.id);
  const title = str(value.title);
  if (id === null || !title) return null;
  return {
    id,
    title,
    year: num(value.year),
    rating: num(value.rating),
    posterUrl: str(value.posterUrl),
    tmdbUrl: str(value.tmdbUrl),
    imdbUrl: str(value.imdbUrl),
    basedOnBook: typeof value.basedOnBook === 'boolean' ? value.basedOnBook : null,
  };
}

export class TurnContext {
  readonly movies = new Map<number, MovieCard>();
  readonly actions: OpenUrlAction[] = [];
  /** Se detectó prompt injection en los datos de alguna herramienta. */
  indirectInjection = false;
  toolCalls = 0;

  /** Registra los datos estructurados devueltos por una herramienta MCP. */
  record(structured: Record<string, unknown> | null): void {
    if (!structured) return;
    const list = Array.isArray(structured.movies) ? structured.movies : [];
    for (const item of [...list, structured.movie]) {
      const card = toMovieCard(item);
      if (!card) continue;
      const previous = this.movies.get(card.id);
      // Los detalles completan el resumen sin borrar datos ya conocidos.
      this.movies.set(card.id, {
        ...card,
        ...(previous && {
          posterUrl: card.posterUrl ?? previous.posterUrl,
          imdbUrl: card.imdbUrl ?? previous.imdbUrl,
          basedOnBook: card.basedOnBook ?? previous.basedOnBook,
        }),
      });
    }
  }

  /** Agrega una acción para abrir una pestaña. Devuelve `false` si no se permite. */
  addOpenAction(structured: Record<string, unknown> | null): boolean {
    if (!structured || structured.action !== 'open_url') return false;
    const url = str(structured.url);
    const site = structured.site;
    if (!url || (site !== 'imdb' && site !== 'google_books') || !isAllowedReferenceUrl(url)) {
      return false;
    }
    if (this.actions.length >= MAX_OPEN_ACTIONS || this.actions.some((a) => a.url === url)) {
      return false;
    }
    this.actions.push({
      site,
      url,
      label: str(structured.label) ?? url,
      openedOnHost: structured.openedOnHost === true,
    });
    return true;
  }

  /** Películas mencionadas por título en el texto final. */
  moviesMentionedIn(text: string): MovieCard[] {
    const lower = text.toLowerCase();
    return [...this.movies.values()].filter((movie) => lower.includes(movie.title.toLowerCase()));
  }
}
