import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '../../core/types';
import { MessageList } from './MessageList';

const user: ChatMessage = { id: 'u', role: 'user', content: 'hola', createdAt: 1, status: 'done' };
const bot: ChatMessage = {
  id: 'a',
  role: 'assistant',
  content: 'hey',
  createdAt: 2,
  status: 'done',
};

describe('MessageList', () => {
  it('muestra bienvenida y sugerencias cuando está vacía', async () => {
    const onSuggestion = vi.fn();
    render(
      <MessageList
        messages={[]}
        isResponding={false}
        welcomeMessage="**Bienvenido**"
        suggestions={['Uno', 'Dos']}
        onSuggestion={onSuggestion}
      />,
    );
    expect(screen.getByText('Bienvenido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dos' }));
    expect(onSuggestion).toHaveBeenCalledWith('Dos');
  });

  it('oculta las sugerencias cuando ya hay mensajes', () => {
    render(<MessageList messages={[user]} isResponding={false} suggestions={['Uno']} />);
    expect(screen.queryByRole('button', { name: 'Uno' })).toBeNull();
  });

  it('muestra el indicador de escritura mientras espera la respuesta', () => {
    const { rerender } = render(<MessageList messages={[user]} isResponding />);
    expect(screen.getByRole('status', { name: 'El agente está escribiendo' })).toBeInTheDocument();

    rerender(<MessageList messages={[user, { ...bot, status: 'streaming' }]} isResponding />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renderiza los mensajes en orden dentro de un log accesible', () => {
    render(<MessageList messages={[user, bot]} isResponding={false} />);
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getAllByTestId(/message-/).map((el) => el.dataset.testid)).toEqual([
      'message-user',
      'message-assistant',
    ]);
  });

  it('hace scroll al final cuando llegan mensajes', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<MessageList messages={[user]} isResponding={false} />);
    rerender(<MessageList messages={[user, bot]} isResponding={false} />);
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
