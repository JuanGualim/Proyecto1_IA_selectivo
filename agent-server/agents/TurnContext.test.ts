// @vitest-environment node
import { MAX_OPEN_ACTIONS, TurnContext } from './TurnContext.ts';

const SUMMARY = {
  id: 1,
  title: 'Dune',
  year: 2021,
  rating: 7.8,
  posterUrl: 'https://image.tmdb.org/t/p/w342/p.jpg',
  tmdbUrl: 'https://www.themoviedb.org/movie/1',
};

describe('TurnContext', () => {
  it('registra películas de listas y completa con detalles', () => {
    const context = new TurnContext();
    context.record({ movies: [SUMMARY, { id: 'malo' }, null] });
    context.record({
      movie: {
        ...SUMMARY,
        posterUrl: null,
        imdbUrl: 'https://www.imdb.com/title/tt1/',
        basedOnBook: true,
      },
    });
    context.record(null);

    expect([...context.movies.values()]).toEqual([
      {
        ...SUMMARY,
        imdbUrl: 'https://www.imdb.com/title/tt1/',
        basedOnBook: true,
      },
    ]);
  });

  it('crea tarjetas con valores nulos si faltan campos', () => {
    const context = new TurnContext();
    context.record({ movie: { id: 2, title: 'X' } });
    expect(context.movies.get(2)).toEqual({
      id: 2,
      title: 'X',
      year: null,
      rating: null,
      posterUrl: null,
      tmdbUrl: null,
      imdbUrl: null,
      basedOnBook: null,
    });
  });

  it('solo acepta acciones open_url válidas, sin duplicados y con límite', () => {
    const context = new TurnContext();
    const imdb = {
      action: 'open_url',
      site: 'imdb',
      url: 'https://www.imdb.com/title/tt1160419/',
      label: 'IMDb',
    };

    expect(context.addOpenAction(imdb)).toBe(true);
    expect(context.addOpenAction(imdb)).toBe(false);
    expect(context.addOpenAction({ ...imdb, url: 'https://evil.test/' })).toBe(false);
    expect(context.addOpenAction({ ...imdb, site: 'otro' })).toBe(false);
    expect(context.addOpenAction({ action: 'otra' })).toBe(false);
    expect(context.addOpenAction(null)).toBe(false);
    expect(
      context.addOpenAction({
        action: 'open_url',
        site: 'google_books',
        url: 'https://books.google.com/books?id=B1',
      }),
    ).toBe(true);
    expect(context.addOpenAction({ ...imdb, url: 'https://www.imdb.com/title/tt0816692/' })).toBe(
      false,
    );
    expect(context.actions).toHaveLength(MAX_OPEN_ACTIONS);
    expect(context.actions[1]?.label).toBe('https://books.google.com/books?id=B1');
  });

  it('encuentra las películas mencionadas en el texto', () => {
    const context = new TurnContext();
    context.record({ movies: [SUMMARY, { ...SUMMARY, id: 3, title: 'Arrival' }] });
    expect(context.moviesMentionedIn('Te recomiendo DUNE').map((movie) => movie.id)).toEqual([1]);
  });
});
