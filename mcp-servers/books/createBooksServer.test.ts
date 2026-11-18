// @vitest-environment node
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callJson, connectInMemory } from '../shared/testing.ts';
import { createBooksServer, type BooksApi } from './createBooksServer.ts';
import type { Book } from './googleBooksClient.ts';

const BOOK: Book = {
  id: 'B1',
  title: 'Dune',
  authors: ['Frank Herbert'],
  year: 1965,
  description: 'Novela',
  pageCount: 600,
  rating: 4.5,
  ratingsCount: 10,
  categories: [],
  language: 'es',
  thumbnailUrl: null,
  googleBooksUrl: 'https://books.google.com/books?id=B1',
};

describe('servidor MCP de libros', () => {
  let books: { [K in keyof BooksApi]: ReturnType<typeof vi.fn> };
  let client: Client;

  beforeEach(async () => {
    books = {
      searchBooks: vi.fn(async () => [BOOK]),
      getBook: vi.fn(async () => BOOK),
      findBookForMovie: vi.fn(async () => [{ ...BOOK, matchScore: 0.9 }]),
    };
    client = await connectInMemory(createBooksServer(books as unknown as BooksApi));
  });

  afterEach(async () => {
    await client.close();
  });

  it('expone tres herramientas de solo lectura', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'find_book_for_movie',
      'get_book_details',
      'search_books',
    ]);
  });

  it('search_books busca con autor y límite', async () => {
    const { data } = await callJson(client, 'search_books', {
      query: 'Dune',
      author: 'Herbert',
      limit: 2,
    });
    expect(data).toEqual({ books: [BOOK] });
    expect(books.searchBooks).toHaveBeenCalledWith('Dune', 'Herbert', 2);
  });

  it('get_book_details valida el id del volumen', async () => {
    expect((await callJson(client, 'get_book_details', { volumeId: 'B1xx' })).data).toEqual({
      book: BOOK,
    });
    const { result } = await callJson(client, 'get_book_details', { volumeId: '../x?y' });
    expect(result.isError).toBe(true);
    expect(books.getBook).toHaveBeenCalledTimes(1);
  });

  it('find_book_for_movie indica si probablemente existe el libro', async () => {
    const { data } = await callJson(client, 'find_book_for_movie', {
      movieTitle: 'Dune',
      movieYear: 2021,
    });
    expect(data).toMatchObject({ likelyHasBook: true, candidates: [{ id: 'B1' }] });

    books.findBookForMovie.mockResolvedValueOnce([{ ...BOOK, matchScore: 0.4 }]);
    const weak = await callJson(client, 'find_book_for_movie', { movieTitle: 'Avatar' });
    expect(weak.data).toMatchObject({ likelyHasBook: false });
  });

  it('devuelve error de herramienta si la API falla', async () => {
    books.searchBooks.mockRejectedValueOnce(new Error('caída'));
    const { result } = await callJson(client, 'search_books', { query: 'x' });
    expect(result.isError).toBe(true);
  });
});
