import {
  asArray,
  asNumber,
  asString,
  buildUrl,
  fetchJson,
  isRecord,
  type FetchLike,
} from '../shared/http.ts';

/** Cliente de la API de Google Books (v1). La API key es opcional. */

export const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1';
const MAX_DESCRIPTION = 1200;
const SAFE_IMAGE_HOSTS = new Set(['books.google.com', 'books.googleusercontent.com']);

export interface Book {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  description: string;
  pageCount: number | null;
  rating: number | null;
  ratingsCount: number;
  categories: string[];
  language: string | null;
  thumbnailUrl: string | null;
  googleBooksUrl: string;
}

export interface BookMatch extends Book {
  /** Puntaje heurístico de que sea la obra en la que se basa la película (0-1). */
  matchScore: number;
}

export interface GoogleBooksClientOptions {
  apiKey?: string;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}

export class GoogleBooksClient {
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly baseUrl: string;

  constructor(options: GoogleBooksClientOptions = {}) {
    this.apiKey = options.apiKey || undefined;
    this.fetchImpl = options.fetchImpl;
    this.baseUrl = options.baseUrl ?? GOOGLE_BOOKS_API_URL;
  }

  async searchBooks(query: string, author?: string, limit = 5): Promise<Book[]> {
    const q = author ? `${query} inauthor:${author}` : query;
    const data = await this.get('/volumes', { q, maxResults: limit, printType: 'books' });
    return parseVolumes(data);
  }

  async getBook(volumeId: string): Promise<Book> {
    const book = parseBook(await this.get(`/volumes/${encodeURIComponent(volumeId)}`, {}));
    if (!book) throw new Error(`Google Books no devolvió datos válidos para ${volumeId}.`);
    return book;
  }

  /**
   * Busca el libro en el que podría basarse una película. Prioriza coincidencias exactas de
   * título y libros publicados antes del estreno.
   */
  async findBookForMovie(title: string, movieYear?: number, limit = 3): Promise<BookMatch[]> {
    const data = await this.get('/volumes', {
      q: `intitle:${title}`,
      maxResults: 15,
      printType: 'books',
      orderBy: 'relevance',
    });
    return parseVolumes(data)
      .map((book) => ({ ...book, matchScore: scoreMatch(book, title, movieYear) }))
      .filter((book) => book.matchScore > 0.3)
      .sort((a, b) => b.matchScore - a.matchScore || b.ratingsCount - a.ratingsCount)
      .slice(0, limit);
  }

  private get(path: string, params: Record<string, string | number | undefined>): Promise<unknown> {
    return fetchJson(buildUrl(`${this.baseUrl}${path}`, { ...params, key: this.apiKey }), {
      fetchImpl: this.fetchImpl,
    });
  }
}

function normalizeTitle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreMatch(book: Book, movieTitle: string, movieYear?: number): number {
  const target = normalizeTitle(movieTitle);
  const title = normalizeTitle(book.title);
  let score = 0;
  if (title === target) score += 0.6;
  else if (title.startsWith(target) || target.startsWith(title)) score += 0.4;
  else if (title.includes(target)) score += 0.2;

  if (movieYear && book.year) {
    score += book.year <= movieYear ? 0.3 : -0.2;
  }
  if (book.ratingsCount > 0) score += 0.1;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

/** Acepta solo miniaturas de dominios de Google Books y fuerza HTTPS. */
export function safeThumbnail(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/^http:\/\//, 'https://'));
    return url.protocol === 'https:' && SAFE_IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function parseBook(value: unknown): Book | null {
  if (!isRecord(value) || !isRecord(value.volumeInfo)) return null;
  const id = asString(value.id);
  const info = value.volumeInfo;
  const title = asString(info.title);
  if (!id || !title) return null;
  const images = isRecord(info.imageLinks) ? info.imageLinks : {};
  const year = Number.parseInt((asString(info.publishedDate) ?? '').slice(0, 4), 10);
  const strings = (list: unknown) =>
    asArray(list).filter((item): item is string => typeof item === 'string');

  return {
    id,
    title: asString(info.subtitle) ? `${title}: ${info.subtitle as string}` : title,
    authors: strings(info.authors),
    year: Number.isFinite(year) ? year : null,
    description: truncate(asString(info.description) ?? '', MAX_DESCRIPTION),
    pageCount: asNumber(info.pageCount) ?? null,
    rating: asNumber(info.averageRating) ?? null,
    ratingsCount: asNumber(info.ratingsCount) ?? 0,
    categories: strings(info.categories),
    language: asString(info.language) ?? null,
    thumbnailUrl: safeThumbnail(images.thumbnail ?? images.smallThumbnail),
    googleBooksUrl: `https://books.google.com/books?id=${encodeURIComponent(id)}`,
  };
}

function parseVolumes(data: unknown): Book[] {
  return asArray(isRecord(data) ? data.items : undefined).flatMap((item) => {
    const book = parseBook(item);
    return book ? [book] : [];
  });
}
