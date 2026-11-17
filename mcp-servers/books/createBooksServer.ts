import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeTool } from '../shared/toolResult.ts';
import type { GoogleBooksClient } from './googleBooksClient.ts';

export type BooksApi = Pick<GoogleBooksClient, 'searchBooks' | 'getBook' | 'findBookForMovie'>;

const limit = z.number().int().min(1).max(10).optional().describe('Máximo de resultados (1-10).');

/** Servidor MCP con las herramientas de libros (Google Books). */
export function createBooksServer(books: BooksApi): McpServer {
  const server = new McpServer({ name: 'agichat-books', version: '1.0.0' });
  const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

  server.registerTool(
    'search_books',
    {
      title: 'Buscar libros',
      description:
        'Busca libros en Google Books por título o tema. Devuelve id, autores, año, descripción y calificación.',
      inputSchema: {
        query: z.string().min(1).max(200),
        author: z.string().max(100).optional(),
        limit,
      },
      annotations: readOnly,
    },
    ({ query, author, limit: max }) =>
      safeTool(async () => ({ books: await books.searchBooks(query, author, max) })),
  );

  server.registerTool(
    'get_book_details',
    {
      title: 'Detalles de un libro',
      description: 'Obtiene los detalles de un libro por su id (volumeId) de Google Books.',
      inputSchema: {
        volumeId: z
          .string()
          .regex(/^[\w-]{4,40}$/)
          .describe('Id del volumen de Google Books.'),
      },
      annotations: readOnly,
    },
    ({ volumeId }) => safeTool(async () => ({ book: await books.getBook(volumeId) })),
  );

  server.registerTool(
    'find_book_for_movie',
    {
      title: 'Buscar el libro de una película',
      description:
        'Busca el libro en el que se basa una película. Usa el título ORIGINAL de la película y su año. ' +
        'Devuelve candidatos con matchScore (0-1); si ninguno supera 0.6 probablemente no hay libro.',
      inputSchema: {
        movieTitle: z.string().min(1).max(200).describe('Título original de la película.'),
        movieYear: z.number().int().min(1888).max(2100).optional(),
        limit,
      },
      annotations: readOnly,
    },
    ({ movieTitle, movieYear, limit: max }) =>
      safeTool(async () => {
        const candidates = await books.findBookForMovie(movieTitle, movieYear, max);
        return {
          candidates,
          likelyHasBook: candidates.some((book) => book.matchScore >= 0.6),
        };
      }),
  );

  return server;
}
