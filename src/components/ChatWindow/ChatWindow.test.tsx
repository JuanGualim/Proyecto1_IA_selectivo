import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseChatResult } from '../../hooks/useChat';
import { ChatWindow } from './ChatWindow';

function chat(overrides: Partial<UseChatResult> = {}): UseChatResult {
  return {
    messages: [],
    isResponding: false,
    connection: 'open',
    error: null,
    sendMessage: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    dismissError: vi.fn(),
    ...overrides,
  };
}

describe('ChatWindow', () => {
  it('muestra título, subtítulo y estado de conexión', () => {
    render(<ChatWindow chat={chat()} title="Soporte" subtitle="Tienda" />);
    expect(screen.getByRole('dialog', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toHaveTextContent('En línea');
    expect(screen.getByText(/Tienda/)).toBeInTheDocument();
  });

  it.each([
    ['connecting', 'Conectando…'],
    ['error', 'Sin conexión'],
    ['closed', 'Desconectado'],
  ] as const)('muestra el estado %s', (connection, label) => {
    render(<ChatWindow chat={chat({ connection })} title="x" />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(label);
  });

  it('muestra el error y permite descartarlo', async () => {
    const dismissError = vi.fn();
    render(<ChatWindow chat={chat({ error: 'Falló', dismissError })} title="x" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
    await userEvent.click(screen.getByRole('button', { name: 'Descartar error' }));
    expect(dismissError).toHaveBeenCalled();
  });

  it('borra la conversación solo si hay mensajes y no está respondiendo', async () => {
    const clear = vi.fn();
    const message = { id: '1', role: 'user', content: 'a', createdAt: 1, status: 'done' } as const;
    const { rerender } = render(<ChatWindow chat={chat({ clear })} title="x" />);
    expect(screen.getByRole('button', { name: 'Borrar conversación' })).toBeDisabled();

    rerender(
      <ChatWindow chat={chat({ clear, messages: [message], isResponding: true })} title="x" />,
    );
    expect(screen.getByRole('button', { name: 'Borrar conversación' })).toBeDisabled();

    rerender(<ChatWindow chat={chat({ clear, messages: [message] })} title="x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Borrar conversación' }));
    expect(clear).toHaveBeenCalled();
  });

  it('muestra el botón cerrar solo si recibe onClose', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<ChatWindow chat={chat()} title="x" />);
    expect(screen.queryByRole('button', { name: 'Cerrar chat' })).toBeNull();
    rerender(<ChatWindow chat={chat()} title="x" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar chat' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('deshabilita el input mientras el agente responde', () => {
    render(<ChatWindow chat={chat({ isResponding: true })} title="x" />);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });
});
