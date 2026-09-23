import { render, screen } from '@testing-library/react';
import { WelcomeHero } from './WelcomeHero';

describe('WelcomeHero', () => {
  it('muestra el saludo, la descripción y el avatar por defecto', () => {
    render(<WelcomeHero greeting="¡Hola soy Sofía!" description="Escribe una duda" />);
    expect(screen.getByRole('heading', { name: '¡Hola soy Sofía!' })).toBeInTheDocument();
    expect(screen.getByText('Escribe una duda')).toBeInTheDocument();
    expect(screen.getByTestId('default-avatar')).toBeInTheDocument();
  });

  it('usa una imagen propia como avatar', () => {
    const { container } = render(<WelcomeHero greeting="Hola" avatarUrl="https://x.dev/a.png" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x.dev/a.png');
    expect(screen.queryByTestId('default-avatar')).toBeNull();
  });

  it('omite la descripción si no se indica', () => {
    const { container } = render(<WelcomeHero greeting="Hola" />);
    expect(container.querySelector('.agichat-hero__description')).toBeNull();
  });

  it('resalta el nombre del asistente dentro del saludo', () => {
    const { container } = render(
      <WelcomeHero greeting="¡Hola soy tu asistente virtual Sofía!" highlight="Sofía" />,
    );
    expect(container.querySelector('.agichat-hero__highlight')).toHaveTextContent('Sofía');
    expect(
      screen.getByRole('heading', { name: '¡Hola soy tu asistente virtual Sofía!' }),
    ).toBeInTheDocument();
  });

  it('no resalta nada si el texto no aparece en el saludo', () => {
    const { container } = render(<WelcomeHero greeting="Bienvenido" highlight="Sofía" />);
    expect(container.querySelector('.agichat-hero__highlight')).toBeNull();
  });
});
