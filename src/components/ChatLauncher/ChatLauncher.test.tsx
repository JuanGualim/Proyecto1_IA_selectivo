import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatLauncher } from './ChatLauncher';

describe('ChatLauncher', () => {
  it('alterna la etiqueta según el estado', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ChatLauncher isOpen={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Abrir chat' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalled();

    rerender(<ChatLauncher isOpen onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Cerrar chat' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('muestra el contador de no leídos solo cuando está cerrado', () => {
    const { rerender } = render(<ChatLauncher isOpen={false} onToggle={vi.fn()} unreadCount={3} />);
    expect(screen.getByLabelText('3 mensajes nuevos')).toHaveTextContent('3');

    rerender(<ChatLauncher isOpen={false} onToggle={vi.fn()} unreadCount={12} />);
    expect(screen.getByLabelText('12 mensajes nuevos')).toHaveTextContent('9+');

    rerender(<ChatLauncher isOpen onToggle={vi.fn()} unreadCount={3} />);
    expect(screen.queryByLabelText(/mensajes nuevos/)).toBeNull();
  });
});
