import { render, screen } from '@testing-library/react';
import { TMDB_ATTRIBUTION } from '../../core/attribution';
import { Attribution } from './Attribution';

describe('Attribution', () => {
  it('muestra el logo y el aviso oficial de TMDB con enlace a su sitio', () => {
    render(<Attribution attribution={TMDB_ATTRIBUTION} />);
    const logo = screen.getByRole('img', { name: 'The Movie Database (TMDB)' });
    expect(logo).toHaveAttribute('src', expect.stringContaining('themoviedb.org/assets'));
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.themoviedb.org/');
    expect(
      screen.getByText(/not endorsed, certified, or otherwise approved by TMDB/),
    ).toBeVisible();
  });

  it('funciona con solo texto o con logo sin enlace', () => {
    const { rerender, container } = render(<Attribution attribution={{ text: 'Datos de X' }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Datos de X')).toBeInTheDocument();

    rerender(<Attribution attribution={{ text: 'Y', logoUrl: 'https://x.test/l.svg' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
