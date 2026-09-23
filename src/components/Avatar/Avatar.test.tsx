import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('usa el osito por defecto escalado al tamaño', () => {
    const { container } = render(<Avatar size={50} />);
    const icon = screen.getByTestId('default-avatar');
    expect(icon).toHaveAttribute('width', '32');
    expect(container.firstElementChild).toHaveStyle({ width: '50px', height: '50px' });
  });

  it('muestra una imagen propia y acepta clases extra', () => {
    const { container } = render(<Avatar size={30} src="https://x.dev/a.png" className="extra" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x.dev/a.png');
    expect(container.firstElementChild).toHaveClass('agichat-avatar', 'extra');
    expect(screen.queryByTestId('default-avatar')).toBeNull();
  });
});
