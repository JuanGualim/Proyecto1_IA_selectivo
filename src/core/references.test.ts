import { buildReferenceLink, isAllowedReferenceUrl } from './references';

describe('buildReferenceLink', () => {
  it('construye la ficha de IMDb a partir del id', () => {
    expect(buildReferenceLink({ site: 'imdb', id: 'tt1160419' })).toEqual({
      site: 'imdb',
      url: 'https://www.imdb.com/title/tt1160419/',
      label: 'IMDb',
    });
  });

  it('usa la búsqueda de IMDb si el id no es válido', () => {
    const link = buildReferenceLink({
      site: 'imdb',
      id: 'https://evil.test',
      query: ' Dune\n2021 ',
    });
    expect(link?.url).toBe('https://www.imdb.com/find/?q=Dune%202021&s=tt');
    expect(link?.label).toBe('IMDb: Dune 2021');
  });

  it('construye la ficha y la búsqueda de Google Books', () => {
    expect(buildReferenceLink({ site: 'google_books', id: 'B1_-xyz' })?.url).toBe(
      'https://books.google.com/books?id=B1_-xyz',
    );
    expect(buildReferenceLink({ site: 'google_books', query: 'Dune & Herbert' })?.url).toBe(
      'https://www.google.com/search?tbm=bks&q=Dune%20%26%20Herbert',
    );
  });

  it('limita la longitud de la búsqueda', () => {
    const link = buildReferenceLink({ site: 'imdb', query: 'a'.repeat(500) });
    expect(link?.label.length).toBeLessThan(140);
  });

  it('devuelve null sin datos válidos o con un sitio desconocido', () => {
    expect(buildReferenceLink({ site: 'imdb' })).toBeNull();
    expect(buildReferenceLink({ site: 'google_books', query: '   ' })).toBeNull();
    expect(buildReferenceLink({ site: 'otro' as 'imdb', query: 'x' })).toBeNull();
  });
});

describe('isAllowedReferenceUrl', () => {
  it.each([
    'https://www.imdb.com/title/tt1160419/',
    'https://www.imdb.com/find/?q=dune&s=tt',
    'https://books.google.com/books?id=B1',
    'https://www.google.com/search?tbm=bks&q=dune',
  ])('permite %s', (url) => {
    expect(isAllowedReferenceUrl(url)).toBe(true);
  });

  it.each([
    'http://www.imdb.com/title/tt1160419/',
    'https://evil.test/books',
    'https://www.imdb.com.evil.test/title/tt1/',
    'https://user:pass@www.imdb.com/find/',
    'https://www.imdb.com:8443/find/',
    'https://www.google.com/url?q=https://evil.test',
    'https://www.google.com/search?q=cualquier+cosa',
    'javascript:alert(1)',
    'no es una url',
  ])('bloquea %s', (url) => {
    expect(isAllowedReferenceUrl(url)).toBe(false);
  });
});
