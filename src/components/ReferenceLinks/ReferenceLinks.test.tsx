import { render, screen } from '@testing-library/react';
import { ReferenceLinks } from './ReferenceLinks';

const IMDB = 'https://www.imdb.com/title/tt1160419/';

describe('ReferenceLinks', () => {
  it('no renderiza nada sin enlaces', () => {
    const { container } = render(<ReferenceLinks />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra cada estado con un enlace seguro', () => {
    render(
      <ReferenceLinks
        links={[
          { url: IMDB, label: 'IMDb', status: 'opened' },
          { url: 'https://books.google.com/books?id=B1', label: 'Google Books', status: 'blocked' },
          { url: 'https://www.imdb.com/find/?q=x&s=tt', label: 'IMDb: x', status: 'pending' },
        ]}
      />,
    );

    const list = screen.getByRole('list', { name: 'Sitios abiertos por el agente' });
    expect(list).toBeInTheDocument();
    const opened = screen.getByRole('link', { name: /Abrí en una pestaña nueva: IMDb$/ });
    expect(opened).toHaveAttribute('href', IMDB);
    expect(opened).toHaveAttribute('target', '_blank');
    expect(opened).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      screen.getByRole('link', { name: /bloqueó la pestaña.*Google Books/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abriendo: IMDb: x/ })).toBeInTheDocument();
  });
});
