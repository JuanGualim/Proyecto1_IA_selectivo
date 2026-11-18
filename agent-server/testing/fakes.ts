import { buildReferenceLink, type ReferenceSite } from '../../src/core/references.ts';
import type { ToolExecutor } from '../agents/specialists.ts';
import type { LlmRequest, LlmResponse, ToolDefinition } from '../llm/LlmProvider.ts';
import type { ToolCallOutcome } from '../mcp/McpToolbox.ts';

/**
 * Dobles de prueba compartidos por los tests del agente y las evals sin red.
 */

export const DUNE_SUMMARY = {
  id: 438631,
  title: 'Dune',
  originalTitle: 'Dune',
  year: 2021,
  overview: 'Paul Atreides viaja al planeta más peligroso del universo.',
  rating: 7.8,
  posterUrl: 'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
  tmdbUrl: 'https://www.themoviedb.org/movie/438631',
};

export const DUNE_DETAILS = {
  ...DUNE_SUMMARY,
  genres: ['Ciencia ficción', 'Aventura'],
  runtimeMinutes: 155,
  imdbId: 'tt1160419',
  imdbUrl: 'https://www.imdb.com/title/tt1160419/',
  basedOnBook: true,
  keywords: ['based on novel or book'],
};

export const DUNE_BOOK = {
  id: 'B1dune',
  title: 'Dune',
  authors: ['Frank Herbert'],
  year: 1965,
  description: 'La novela de ciencia ficción más vendida de la historia.',
  pageCount: 704,
  rating: 4.5,
  ratingsCount: 1200,
  categories: ['Fiction'],
  language: 'es',
  thumbnailUrl: null,
  googleBooksUrl: 'https://books.google.com/books?id=B1dune',
  matchScore: 0.9,
};

type Handler = (input: Record<string, unknown>) => ToolCallOutcome | Promise<ToolCallOutcome>;

export function ok(server: string, data: Record<string, unknown>): ToolCallOutcome {
  return { content: JSON.stringify(data), isError: false, structured: data, server };
}

/** Catálogo de herramientas falso con respuestas por defecto realistas. */
export class FakeTools implements ToolExecutor {
  readonly calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  readonly handlers: Record<string, Handler> = {
    search_movies: () => ok('tmdb', { movies: [DUNE_SUMMARY] }),
    recommend_movies: () => ok('tmdb', { movies: [DUNE_SUMMARY] }),
    get_movie_details: () => ok('tmdb', { movie: DUNE_DETAILS }),
    list_genres: () => ok('tmdb', { genres: [{ id: 878, name: 'Ciencia ficción' }] }),
    search_books: () => ok('books', { books: [DUNE_BOOK] }),
    get_book_details: () => ok('books', { book: DUNE_BOOK }),
    find_book_for_movie: () => ok('books', { candidates: [DUNE_BOOK], likelyHasBook: true }),
    // Misma lógica que el servidor MCP real: solo enlaces construidos desde ids válidos.
    open_reference: (input) => {
      const link = buildReferenceLink({
        site: input.site as ReferenceSite,
        id: typeof input.id === 'string' ? input.id : undefined,
        query: typeof input.query === 'string' ? input.query : undefined,
      });
      if (!link) {
        return {
          content: 'Datos no válidos.',
          isError: true,
          structured: null,
          server: 'navigator',
        };
      }
      return ok('navigator', { action: 'open_url', ...link, openedOnHost: false });
    },
  };

  definitions(names?: readonly string[]): ToolDefinition[] {
    const all = Object.keys(this.handlers);
    return (names ?? all)
      .filter((name) => all.includes(name))
      .map((name) => ({ name, description: name, inputSchema: { type: 'object' } }));
  }

  async call(name: string, input: Record<string, unknown>): Promise<ToolCallOutcome> {
    this.calls.push({ name, input });
    const handler = this.handlers[name];
    if (!handler) return { content: 'no existe', isError: true, structured: null, server: '' };
    return handler(input);
  }
}

export type AgentRole = 'supervisor' | 'movie_agent' | 'book_agent';

/** Identifica qué agente hace la solicitud según su system prompt. */
export function agentOf(request: LlmRequest): AgentRole {
  if (request.system.startsWith('Eres el agente especialista en películas')) return 'movie_agent';
  if (request.system.startsWith('Eres el agente especialista en libros')) return 'book_agent';
  return 'supervisor';
}

/** Número de pasos ya dados por el agente en esta conversación (respuestas del asistente). */
export function stepOf(request: LlmRequest): number {
  return request.messages.filter((message) => message.role === 'assistant').length;
}

export type RoleScript = Record<AgentRole, (request: LlmRequest, step: number) => LlmResponse>;
