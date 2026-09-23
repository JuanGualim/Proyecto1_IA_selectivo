import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '../../core/types';
import { MessageBubble } from './MessageBubble';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  role: 'assistant',
  content: '**hola**',
  createdAt: new Date(2026, 0, 1, 10, 30).getTime(),
  status: 'done',
  ...overrides,
});

describe('MessageBubble', () => {
  it('renderiza los mensajes del agente como Markdown', () => {
    render(<MessageBubble message={message()} />);
    expect(screen.getByText('hola').tagName).toBe('STRONG');
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });

  it('renderiza los mensajes del usuario como texto plano', () => {
    render(<MessageBubble message={message({ role: 'user' })} />);
    expect(screen.getByText('**hola**')).toBeInTheDocument();
  });

  it('muestra un cursor mientras llega el streaming', () => {
    const { container } = render(<MessageBubble message={message({ status: 'streaming' })} />);
    expect(container.querySelector('.agichat-cursor')).not.toBeNull();
  });

  it('permite reintentar mensajes fallidos del usuario', async () => {
    const onRetry = vi.fn();
    render(
      <MessageBubble message={message({ role: 'user', status: 'error' })} onRetry={onRetry} />,
    );
    expect(screen.getByText('No enviado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(onRetry).toHaveBeenCalledWith('m1');
  });

  it('no muestra reintentar en mensajes fallidos del agente', () => {
    render(<MessageBubble message={message({ status: 'error' })} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
  });
});
