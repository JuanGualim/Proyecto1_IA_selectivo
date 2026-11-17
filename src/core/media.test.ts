import { isAllowedImageUrl } from './media';

describe('isAllowedImageUrl', () => {
  it.each([
    'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    'https://books.google.com/books/content?id=B1&img=1',
  ])('permite %s', (url) => {
    expect(isAllowedImageUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'http://image.tmdb.org/t/p/w342/a.jpg',
    'https://evil.test/x.png?secreto=1',
    'data:image/png;base64,AAAA',
    'no es url',
  ])('bloquea %s', (url) => {
    expect(isAllowedImageUrl(url)).toBe(false);
  });

  it('acepta una lista de dominios propia', () => {
    expect(isAllowedImageUrl('https://cdn.cliente.com/a.png', ['cdn.cliente.com'])).toBe(true);
  });
});
