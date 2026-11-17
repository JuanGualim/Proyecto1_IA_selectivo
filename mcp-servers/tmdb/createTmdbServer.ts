import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TMDB_ATTRIBUTION as TMDB_NOTICE } from '../../src/core/attribution.ts';
import { safeTool } from '../shared/toolResult.ts';
import type { TmdbClient } from './tmdbClient.ts';

/** Atribución exigida por los términos de uso de la API de TMDB. */
export const TMDB_ATTRIBUTION = TMDB_NOTICE.text;

export type TmdbApi = Pick<
  TmdbClient,
  | 'searchMovies'
  | 'getMovieDetails'
  | 'getRecommendationsFor'
  | 'discoverMovies'
  | 'findGenre'
  | 'listGenres'
>;

const limit = z.number().int().min(1).max(10).optional().describe('Máximo de resultados (1-10).');
const year = z.number().int().min(1888).max(2100);

/**
 * Servidor MCP con las herramientas de películas. Es independiente del agente:
 * cualquier cliente MCP (otro agente, Claude Desktop, etc.) puede reutilizarlo.
 */
export function createTmdbServer(tmdb: TmdbApi): McpServer {
  const server = new McpServer({ name: 'agichat-tmdb', version: '1.0.0' });
  const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

  server.registerTool(
    'search_movies',
    {
      title: 'Buscar películas',
      description:
        'Busca películas por título en TMDB. Devuelve id, título, año, sinopsis, calificación y póster.',
      inputSchema: {
        query: z.string().min(1).max(200).describe('Título o parte del título.'),
        year: year.optional().describe('Año de estreno para desambiguar.'),
        limit,
      },
      annotations: readOnly,
    },
    ({ query, year: releaseYear, limit: max }) =>
      safeTool(async () => ({
        movies: await tmdb.searchMovies(query, releaseYear, max),
        attribution: TMDB_ATTRIBUTION,
      })),
  );

  server.registerTool(
    'get_movie_details',
    {
      title: 'Detalles de una película',
      description:
        'Obtiene los detalles de una película por su id de TMDB: géneros, duración, id de IMDb y si está basada en un libro (basedOnBook).',
      inputSchema: { movieId: z.number().int().positive().describe('Id de TMDB.') },
      annotations: readOnly,
    },
    ({ movieId }) =>
      safeTool(async () => ({
        movie: await tmdb.getMovieDetails(movieId),
        attribution: TMDB_ATTRIBUTION,
      })),
  );

  server.registerTool(
    'recommend_movies',
    {
      title: 'Recomendar películas',
      description:
        'Recomienda películas populares y bien valoradas. Usa similarToMovieId para películas parecidas a otra, o filtra por género, rango de años y calificación mínima.',
      inputSchema: {
        genre: z
          .string()
          .max(60)
          .optional()
          .describe('Nombre del género, p. ej. "Ciencia ficción".'),
        similarToMovieId: z.number().int().positive().optional(),
        fromYear: year.optional(),
        toYear: year.optional(),
        minRating: z.number().min(0).max(10).optional(),
        limit,
      },
      annotations: readOnly,
    },
    ({ genre, similarToMovieId, fromYear, toYear, minRating, limit: max }) =>
      safeTool(async () => {
        if (similarToMovieId !== undefined) {
          return {
            movies: await tmdb.getRecommendationsFor(similarToMovieId, max),
            attribution: TMDB_ATTRIBUTION,
          };
        }
        let genreId: number | undefined;
        if (genre) {
          const found = await tmdb.findGenre(genre);
          if (!found) {
            const available = (await tmdb.listGenres()).map((item) => item.name);
            throw new Error(
              `Género "${genre}" no encontrado. Disponibles: ${available.join(', ')}.`,
            );
          }
          genreId = found.id;
        }
        return {
          movies: await tmdb.discoverMovies({ genreId, fromYear, toYear, minRating, limit: max }),
          attribution: TMDB_ATTRIBUTION,
        };
      }),
  );

  server.registerTool(
    'list_genres',
    {
      title: 'Listar géneros',
      description: 'Lista los géneros de películas disponibles en TMDB.',
      annotations: readOnly,
    },
    () => safeTool(async () => ({ genres: await tmdb.listGenres() })),
  );

  return server;
}
