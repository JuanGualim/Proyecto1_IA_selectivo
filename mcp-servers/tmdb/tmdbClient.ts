import {
  asArray,
  asNumber,
  asString,
  buildUrl,
  fetchJson,
  isRecord,
  type FetchLike,
} from '../shared/http.ts';

/**
 * Cliente de The Movie Database (TMDB) API v3.
 *
 * Normaliza las respuestas a tipos propios para que el resto del sistema no dependa del
 * formato de TMDB. Uso no comercial (curso CC3116, UVG) según los términos de la API.
 */

export const TMDB_API_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w342';
export const TMDB_SITE_URL = 'https://www.themoviedb.org';

/** Palabras clave de TMDB que indican que la película adapta una obra escrita. */
const BOOK_KEYWORD_PATTERN = /based on (?:a )?(?:novel|book|short story|novella|memoir)/i;

export interface MovieSummary {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  rating: number | null;
  posterUrl: string | null;
  tmdbUrl: string;
}

export interface MovieDetails extends MovieSummary {
  genres: string[];
  runtimeMinutes: number | null;
  imdbId: string | null;
  imdbUrl: string | null;
  /** `true` si TMDB la etiqueta como basada en una novela, libro o relato. */
  basedOnBook: boolean;
  keywords: string[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface RecommendOptions {
  genreId?: number;
  fromYear?: number;
  toYear?: number;
  minRating?: number;
  limit?: number;
}

export interface TmdbClientOptions {
  /** API key v3 o token de lectura v4 (empieza con `eyJ`). */
  apiKey: string;
  language?: string;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}

export class TmdbClient {
  private readonly apiKey: string;
  private readonly language: string;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly baseUrl: string;
  private genresCache: Genre[] | null = null;

  constructor(options: TmdbClientOptions) {
    if (!options.apiKey) throw new Error('Falta la API key de TMDB (TMDB_API_KEY).');
    this.apiKey = options.apiKey;
    this.language = options.language ?? 'es-MX';
    this.fetchImpl = options.fetchImpl;
    this.baseUrl = options.baseUrl ?? TMDB_API_URL;
  }

  async searchMovies(query: string, year?: number, limit = 5): Promise<MovieSummary[]> {
    const data = await this.get('/search/movie', { query, year, include_adult: false });
    return parseResults(data).slice(0, limit);
  }

  async getMovieDetails(movieId: number): Promise<MovieDetails> {
    const data = await this.get(`/movie/${movieId}`, {
      append_to_response: 'external_ids,keywords',
    });
    const details = parseMovieDetails(data);
    if (!details) throw new Error(`TMDB no devolvió datos válidos para la película ${movieId}.`);
    return details;
  }

  async getRecommendationsFor(movieId: number, limit = 5): Promise<MovieSummary[]> {
    const data = await this.get(`/movie/${movieId}/recommendations`, {});
    return parseResults(data).slice(0, limit);
  }

  async discoverMovies(options: RecommendOptions = {}): Promise<MovieSummary[]> {
    const { genreId, fromYear, toYear, minRating, limit = 5 } = options;
    const data = await this.get('/discover/movie', {
      with_genres: genreId,
      'primary_release_date.gte': fromYear ? `${fromYear}-01-01` : undefined,
      'primary_release_date.lte': toYear ? `${toYear}-12-31` : undefined,
      'vote_average.gte': minRating,
      'vote_count.gte': 300,
      sort_by: 'popularity.desc',
      include_adult: false,
    });
    return parseResults(data).slice(0, limit);
  }

  async listGenres(): Promise<Genre[]> {
    if (this.genresCache) return this.genresCache;
    const data = await this.get('/genre/movie/list', {});
    const genres = asArray(isRecord(data) ? data.genres : undefined).flatMap((genre) => {
      if (!isRecord(genre)) return [];
      const id = asNumber(genre.id);
      const name = asString(genre.name);
      return id !== undefined && name ? [{ id, name }] : [];
    });
    this.genresCache = genres;
    return genres;
  }

  /** Busca un género por nombre sin distinguir mayúsculas ni tildes (español o inglés). */
  async findGenre(name: string): Promise<Genre | null> {
    const target = normalize(name);
    const genres = await this.listGenres();
    return (
      genres.find((genre) => normalize(genre.name) === target) ??
      genres.find((genre) => normalize(genre.name).includes(target)) ??
      null
    );
  }

  private get(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
  ): Promise<unknown> {
    const isBearer = this.apiKey.startsWith('eyJ');
    const url = buildUrl(`${this.baseUrl}${path}`, {
      ...params,
      language: this.language,
      api_key: isBearer ? undefined : this.apiKey,
    });
    return fetchJson(url, {
      fetchImpl: this.fetchImpl,
      headers: isBearer ? { authorization: `Bearer ${this.apiKey}` } : {},
    });
  }
}

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function yearOf(date: unknown): number | null {
  const text = asString(date);
  const year = text ? Number.parseInt(text.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) ? year : null;
}

export function posterUrl(path: unknown): string | null {
  const value = asString(path);
  return value && /^\/[\w.-]+$/.test(value) ? `${TMDB_IMAGE_URL}${value}` : null;
}

export function parseMovieSummary(value: unknown): MovieSummary | null {
  if (!isRecord(value)) return null;
  const id = asNumber(value.id);
  const title = asString(value.title);
  if (id === undefined || !title) return null;
  return {
    id,
    title,
    originalTitle: asString(value.original_title) ?? title,
    year: yearOf(value.release_date),
    overview: asString(value.overview) ?? '',
    rating: asNumber(value.vote_average) ?? null,
    posterUrl: posterUrl(value.poster_path),
    tmdbUrl: `${TMDB_SITE_URL}/movie/${id}`,
  };
}

function parseResults(data: unknown): MovieSummary[] {
  return asArray(isRecord(data) ? data.results : undefined).flatMap((item) => {
    const movie = parseMovieSummary(item);
    return movie ? [movie] : [];
  });
}

export function parseMovieDetails(value: unknown): MovieDetails | null {
  const summary = parseMovieSummary(value);
  if (!summary || !isRecord(value)) return null;

  const genres = asArray(value.genres).flatMap((genre) =>
    isRecord(genre) && asString(genre.name) ? [genre.name as string] : [],
  );
  const externalIds = isRecord(value.external_ids) ? value.external_ids : {};
  const rawImdbId = asString(value.imdb_id) ?? asString(externalIds.imdb_id);
  const imdbId = rawImdbId && /^tt\d{5,10}$/.test(rawImdbId) ? rawImdbId : null;
  const keywordList = isRecord(value.keywords) ? value.keywords.keywords : undefined;
  const keywords = asArray(keywordList).flatMap((keyword) =>
    isRecord(keyword) && asString(keyword.name) ? [keyword.name as string] : [],
  );

  return {
    ...summary,
    genres,
    runtimeMinutes: asNumber(value.runtime) ?? null,
    imdbId,
    imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
    basedOnBook: keywords.some((keyword) => BOOK_KEYWORD_PATTERN.test(keyword)),
    keywords,
  };
}
