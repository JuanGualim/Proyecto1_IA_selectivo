// @vitest-environment node
import type { FetchLike } from '../shared/http.ts';
import {
  normalize,
  parseMovieDetails,
  parseMovieSummary,
  posterUrl,
  TmdbClient,
} from './tmdbClient.ts';

const DUNE = {
  id: 438631,
  title: 'Dune',
  original_title: 'Dune',
  release_date: '2021-09-15',
  overview: 'Paul Atreides…',
  vote_average: 7.8,
  poster_path: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
};

function fakeFetch(routes: Record<string, unknown>) {
  return vi.fn<FetchLike>(async (url) => {
    const { pathname } = new URL(url);
    const body = routes[pathname.replace('/3', '')];
    if (body === undefined) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

function calledUrl(fetchImpl: ReturnType<typeof fakeFetch>, index = 0): URL {
  return new URL(fetchImpl.mock.calls[index]?.[0] ?? '');
}

describe('TmdbClient', () => {
  it('exige una API key', () => {
    expect(() => new TmdbClient({ apiKey: '' })).toThrow(/TMDB_API_KEY/);
  });

  it('busca películas usando api_key v3 e idioma', async () => {
    const fetchImpl = fakeFetch({ '/search/movie': { results: [DUNE, { id: 'x' }] } });
    const client = new TmdbClient({ apiKey: 'abc123', fetchImpl });

    const movies = await client.searchMovies('dune', 2021);

    expect(movies).toEqual([
      {
        id: 438631,
        title: 'Dune',
        originalTitle: 'Dune',
        year: 2021,
        overview: 'Paul Atreides…',
        rating: 7.8,
        posterUrl: 'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
        tmdbUrl: 'https://www.themoviedb.org/movie/438631',
      },
    ]);
    const url = calledUrl(fetchImpl);
    expect(url.searchParams.get('api_key')).toBe('abc123');
    expect(url.searchParams.get('language')).toBe('es-MX');
    expect(url.searchParams.get('year')).toBe('2021');
  });

  it('usa el token v4 como cabecera Bearer y no en la URL', async () => {
    const fetchImpl = fakeFetch({ '/search/movie': { results: [] } });
    const client = new TmdbClient({ apiKey: 'eyJtoken', fetchImpl, language: 'en-US' });

    await client.searchMovies('x');

    expect(calledUrl(fetchImpl).searchParams.has('api_key')).toBe(false);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ authorization: 'Bearer eyJtoken' });
  });

  it('obtiene detalles con IMDb y detecta si está basada en un libro', async () => {
    const fetchImpl = fakeFetch({
      '/movie/438631': {
        ...DUNE,
        runtime: 155,
        genres: [{ name: 'Ciencia ficción' }, { id: 1 }],
        external_ids: { imdb_id: 'tt1160419' },
        keywords: { keywords: [{ name: 'based on novel or book' }, { name: 'desert' }] },
      },
    });
    const client = new TmdbClient({ apiKey: 'k', fetchImpl });

    const details = await client.getMovieDetails(438631);

    expect(details).toMatchObject({
      genres: ['Ciencia ficción'],
      runtimeMinutes: 155,
      imdbId: 'tt1160419',
      imdbUrl: 'https://www.imdb.com/title/tt1160419/',
      basedOnBook: true,
    });
    expect(calledUrl(fetchImpl).searchParams.get('append_to_response')).toBe(
      'external_ids,keywords',
    );
  });

  it('falla con un mensaje claro si los detalles son inválidos', async () => {
    const client = new TmdbClient({ apiKey: 'k', fetchImpl: fakeFetch({ '/movie/1': {} }) });
    await expect(client.getMovieDetails(1)).rejects.toThrow(/datos válidos/);
  });

  it('obtiene recomendaciones similares y descubre por filtros', async () => {
    const fetchImpl = fakeFetch({
      '/movie/1/recommendations': { results: [DUNE] },
      '/discover/movie': { results: [DUNE, DUNE] },
    });
    const client = new TmdbClient({ apiKey: 'k', fetchImpl });

    expect(await client.getRecommendationsFor(1)).toHaveLength(1);
    expect(
      await client.discoverMovies({
        genreId: 878,
        fromYear: 2000,
        toYear: 2010,
        minRating: 7,
        limit: 1,
      }),
    ).toHaveLength(1);
    const url = calledUrl(fetchImpl, 1);
    expect(url.searchParams.get('with_genres')).toBe('878');
    expect(url.searchParams.get('primary_release_date.gte')).toBe('2000-01-01');
    expect(url.searchParams.get('primary_release_date.lte')).toBe('2010-12-31');
    expect(url.searchParams.get('vote_average.gte')).toBe('7');

    await client.discoverMovies();
    expect(calledUrl(fetchImpl, 2).searchParams.has('with_genres')).toBe(false);
  });

  it('lista géneros (con caché) y los encuentra sin importar tildes', async () => {
    const fetchImpl = fakeFetch({
      '/genre/movie/list': {
        genres: [{ id: 878, name: 'Ciencia ficción' }, { id: 27, name: 'Terror' }, 'malo'],
      },
    });
    const client = new TmdbClient({ apiKey: 'k', fetchImpl });

    expect(await client.findGenre('ciencia ficcion')).toEqual({ id: 878, name: 'Ciencia ficción' });
    expect(await client.findGenre('terr')).toEqual({ id: 27, name: 'Terror' });
    expect(await client.findGenre('western')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tolera respuestas sin la lista esperada', async () => {
    const client = new TmdbClient({
      apiKey: 'k',
      fetchImpl: fakeFetch({ '/genre/movie/list': [] }),
    });
    expect(await client.listGenres()).toEqual([]);
  });
});

describe('parsers de TMDB', () => {
  it('normaliza texto', () => {
    expect(normalize('  CIENCIA Ficción ')).toBe('ciencia ficcion');
  });

  it('solo acepta rutas de póster seguras', () => {
    expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(posterUrl('https://evil.test/x.jpg')).toBeNull();
    expect(posterUrl(null)).toBeNull();
  });

  it('usa valores por defecto cuando faltan campos', () => {
    expect(parseMovieSummary({ id: 1, title: 'X', release_date: 'sin fecha' })).toMatchObject({
      originalTitle: 'X',
      year: null,
      overview: '',
      rating: null,
      posterUrl: null,
    });
    expect(parseMovieSummary('x')).toBeNull();
  });

  it('descarta ids de IMDb inválidos y detalles sin datos', () => {
    expect(parseMovieDetails({ id: 1, title: 'X', imdb_id: 'javascript:alert(1)' })).toMatchObject({
      imdbId: null,
      imdbUrl: null,
      basedOnBook: false,
      genres: [],
      keywords: [],
      runtimeMinutes: null,
    });
    expect(parseMovieDetails(null)).toBeNull();
  });
});
