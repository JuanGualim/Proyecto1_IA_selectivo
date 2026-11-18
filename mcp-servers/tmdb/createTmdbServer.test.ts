// @vitest-environment node
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callJson, connectInMemory } from '../shared/testing.ts';
import { createTmdbServer, TMDB_ATTRIBUTION, type TmdbApi } from './createTmdbServer.ts';
import type { MovieDetails, MovieSummary } from './tmdbClient.ts';

const MOVIE: MovieSummary = {
  id: 1,
  title: 'Dune',
  originalTitle: 'Dune',
  year: 2021,
  overview: 'Arrakis',
  rating: 7.8,
  posterUrl: 'https://image.tmdb.org/t/p/w342/p.jpg',
  tmdbUrl: 'https://www.themoviedb.org/movie/1',
};

const DETAILS: MovieDetails = {
  ...MOVIE,
  genres: ['Ciencia ficción'],
  runtimeMinutes: 155,
  imdbId: 'tt1160419',
  imdbUrl: 'https://www.imdb.com/title/tt1160419/',
  basedOnBook: true,
  keywords: ['based on novel or book'],
};

function fakeTmdb(): TmdbApi & Record<keyof TmdbApi, ReturnType<typeof vi.fn>> {
  return {
    searchMovies: vi.fn(async () => [MOVIE]),
    getMovieDetails: vi.fn(async () => DETAILS),
    getRecommendationsFor: vi.fn(async () => [MOVIE]),
    discoverMovies: vi.fn(async () => [MOVIE]),
    findGenre: vi.fn(async (name: string) =>
      name === 'Ciencia ficción' ? { id: 878, name: 'Ciencia ficción' } : null,
    ),
    listGenres: vi.fn(async () => [{ id: 878, name: 'Ciencia ficción' }]),
  };
}

describe('servidor MCP de TMDB', () => {
  let tmdb: ReturnType<typeof fakeTmdb>;
  let client: Client;

  beforeEach(async () => {
    tmdb = fakeTmdb();
    client = await connectInMemory(createTmdbServer(tmdb));
  });

  afterEach(async () => {
    await client.close();
  });

  it('expone las cuatro herramientas de solo lectura', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_movie_details',
      'list_genres',
      'recommend_movies',
      'search_movies',
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
  });

  it('search_movies devuelve películas con la atribución de TMDB', async () => {
    const { data } = await callJson(client, 'search_movies', {
      query: 'dune',
      year: 2021,
      limit: 3,
    });
    expect(data).toEqual({ movies: [MOVIE], attribution: TMDB_ATTRIBUTION });
    expect(tmdb.searchMovies).toHaveBeenCalledWith('dune', 2021, 3);
  });

  it('get_movie_details devuelve detalles', async () => {
    const { data } = await callJson(client, 'get_movie_details', { movieId: 1 });
    expect(data).toMatchObject({ movie: { imdbId: 'tt1160419', basedOnBook: true } });
  });

  it('recommend_movies usa recomendaciones similares si se indica una película', async () => {
    await callJson(client, 'recommend_movies', { similarToMovieId: 1, limit: 2 });
    expect(tmdb.getRecommendationsFor).toHaveBeenCalledWith(1, 2);
    expect(tmdb.discoverMovies).not.toHaveBeenCalled();
  });

  it('recommend_movies resuelve el género y aplica filtros', async () => {
    await callJson(client, 'recommend_movies', {
      genre: 'Ciencia ficción',
      fromYear: 2000,
      minRating: 7,
    });
    expect(tmdb.discoverMovies).toHaveBeenCalledWith({
      genreId: 878,
      fromYear: 2000,
      toYear: undefined,
      minRating: 7,
      limit: undefined,
    });
  });

  it('recommend_movies sin filtros descubre populares', async () => {
    await callJson(client, 'recommend_movies');
    expect(tmdb.discoverMovies).toHaveBeenCalledWith(
      expect.objectContaining({ genreId: undefined }),
    );
  });

  it('recommend_movies informa los géneros disponibles si no encuentra el pedido', async () => {
    const { result, data } = await callJson(client, 'recommend_movies', { genre: 'Western' });
    expect(result.isError).toBe(true);
    expect(data).toMatch(/Disponibles: Ciencia ficción/);
  });

  it('list_genres lista los géneros', async () => {
    const { data } = await callJson(client, 'list_genres');
    expect(data).toEqual({ genres: [{ id: 878, name: 'Ciencia ficción' }] });
  });

  it('rechaza argumentos inválidos sin llamar a la API', async () => {
    const { result } = await callJson(client, 'search_movies', { query: '' });
    expect(result.isError).toBe(true);
    expect(tmdb.searchMovies).not.toHaveBeenCalled();
  });
});
