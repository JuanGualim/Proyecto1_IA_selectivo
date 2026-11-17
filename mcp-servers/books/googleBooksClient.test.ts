// @vitest-environment node
import type { FetchLike } from '../shared/http.ts';
import {
  GoogleBooksClient,
  parseBook,
  safeThumbnail,
  scoreMatch,
  type Book,
} from './googleBooksClient.ts';

function volume(id: string, info: Record<string, unknown>) {
  return { id, volumeInfo: info };
}

const DUNE_BOOK = volume('B1', {
  title: 'Dune',
  authors: ['Frank Herbert'],
  publishedDate: '1965-08-01',
  description: 'Una novela épica.',
  pageCount: 600,
  averageRating: 4.5,
  ratingsCount: 120,
  categories: ['Fiction'],
  language: 'es',
  imageLinks: { thumbnail: 'http://books.google.com/books/content?id=B1&img=1' },
});

function fakeFetch(body: unknown) {
  return vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 }));
}

function calledUrl(fetchImpl: ReturnType<typeof fakeFetch>): URL {
  return new URL(fetchImpl.mock.calls[0]?.[0] ?? '');
}

describe('GoogleBooksClient', () => {
  it('busca libros (con autor) y envía la llave si existe', async () => {
    const fetchImpl = fakeFetch({ items: [DUNE_BOOK, { id: 'malo' }] });
    const client = new GoogleBooksClient({ apiKey: 'KEY', fetchImpl });

    const books = await client.searchBooks('Dune', 'Herbert', 3);

    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      id: 'B1',
      authors: ['Frank Herbert'],
      year: 1965,
      rating: 4.5,
      thumbnailUrl: 'https://books.google.com/books/content?id=B1&img=1',
      googleBooksUrl: 'https://books.google.com/books?id=B1',
    });
    const url = calledUrl(fetchImpl);
    expect(url.searchParams.get('q')).toBe('Dune inauthor:Herbert');
    expect(url.searchParams.get('key')).toBe('KEY');
    expect(url.searchParams.get('maxResults')).toBe('3');
  });

  it('funciona sin llave', async () => {
    const fetchImpl = fakeFetch({});
    expect(await new GoogleBooksClient({ fetchImpl }).searchBooks('x')).toEqual([]);
    expect(calledUrl(fetchImpl).searchParams.has('key')).toBe(false);
  });

  it('obtiene un libro por id', async () => {
    const client = new GoogleBooksClient({ fetchImpl: fakeFetch(DUNE_BOOK) });
    expect((await client.getBook('B1')).title).toBe('Dune');
    const bad = new GoogleBooksClient({ fetchImpl: fakeFetch({}) });
    await expect(bad.getBook('zz')).rejects.toThrow(/datos válidos/);
  });

  it('encuentra el libro fuente de una película ordenado por coincidencia', async () => {
    const fetchImpl = fakeFetch({
      items: [
        volume('B2', { title: 'Dune: guía de la película', publishedDate: '2021' }),
        DUNE_BOOK,
        volume('B3', { title: 'Cocina fácil', publishedDate: '1990' }),
      ],
    });
    const client = new GoogleBooksClient({ fetchImpl });

    const matches = await client.findBookForMovie('Dune', 2021);

    expect(matches.map((book) => book.id)).toEqual(['B1', 'B2']);
    expect(matches[0]?.matchScore).toBe(1);
    expect(calledUrl(fetchImpl).searchParams.get('q')).toBe('intitle:Dune');
  });
});

describe('utilidades de libros', () => {
  const base: Book = {
    id: 'x',
    title: 'Dune',
    authors: [],
    year: 1965,
    description: '',
    pageCount: null,
    rating: null,
    ratingsCount: 0,
    categories: [],
    language: null,
    thumbnailUrl: null,
    googleBooksUrl: '',
  };

  it('puntúa coincidencias de título y fecha', () => {
    expect(scoreMatch(base, 'Dune', 2021)).toBe(0.9);
    expect(scoreMatch({ ...base, year: 2022 }, 'Dune', 2021)).toBe(0.4);
    expect(scoreMatch({ ...base, title: 'Dune Messiah' }, 'Dune')).toBe(0.4);
    expect(scoreMatch({ ...base, title: 'Todo sobre Dune' }, 'Dune')).toBe(0.2);
    expect(scoreMatch({ ...base, title: 'Otro' }, 'Dune')).toBe(0);
  });

  it('solo acepta miniaturas HTTPS de Google Books', () => {
    expect(safeThumbnail('http://books.google.com/a')).toBe('https://books.google.com/a');
    expect(safeThumbnail('https://evil.test/a.png')).toBeNull();
    expect(safeThumbnail('no es url')).toBeNull();
    expect(safeThumbnail(undefined)).toBeNull();
  });

  it('recorta descripciones largas y une el subtítulo', () => {
    const book = parseBook(
      volume('L', { title: 'T', subtitle: 'S', description: 'a'.repeat(2000), publishedDate: 'x' }),
    );
    expect(book?.title).toBe('T: S');
    expect(book?.description.length).toBeLessThanOrEqual(1201);
    expect(book?.year).toBeNull();
    expect(parseBook({ id: 'x' })).toBeNull();
    expect(parseBook(volume('x', {}))).toBeNull();
  });
});
