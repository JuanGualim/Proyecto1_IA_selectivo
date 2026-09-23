import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeTransport } from '../../test/FakeTransport';
import { MockTransport } from '../../transports/MockTransport';
import { ChatWidget } from './ChatWidget';

describe('ChatWidget', () => {
  it('abre y cierra la ventana con el botón flotante', async () => {
    const onOpenChange = vi.fn();
    render(<ChatWidget transport={new FakeTransport()} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(screen.getByRole('dialog', { name: 'Chat con Sofía' })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar chat' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('muestra la bienvenida del wireframe con nombre, saludo y descripción personalizables', () => {
    const { rerender } = render(<ChatWidget transport={new FakeTransport()} mode="inline" />);
    expect(
      screen.getByRole('heading', { name: '¡Hola soy tu asistente virtual Sofía!' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escribe una duda y yo te ayudaré en lo que pueda'),
    ).toBeInTheDocument();

    rerender(
      <ChatWidget
        transport={new FakeTransport()}
        mode="inline"
        assistantName="Max"
        greeting="Bienvenido a la tienda"
        description="Pregunta por tu pedido"
        avatarUrl="https://example.com/max.png"
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Chat con Max' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bienvenido a la tienda' })).toBeInTheDocument();
    expect(screen.getByText('Pregunta por tu pedido')).toBeInTheDocument();
  });

  it('cierra con la tecla Escape', () => {
    render(<ChatWidget transport={new FakeTransport()} defaultOpen />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('aplica tema, posición y color principal', () => {
    const { container } = render(
      <ChatWidget
        transport={new FakeTransport()}
        theme="dark"
        position="bottom-left"
        primaryColor="#ff0000"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(root).toHaveClass('agichat-root--bottom-left');
    expect(root.style.getPropertyValue('--agichat-primary')).toBe('#ff0000');
  });

  it('en modo inline siempre está abierto y no tiene botón flotante', () => {
    render(<ChatWidget transport={new FakeTransport()} mode="inline" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chat/ })).toBeNull();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('cuenta respuestas no leídas mientras está cerrado', async () => {
    const transport = new FakeTransport();
    render(<ChatWidget transport={transport} defaultOpen />);
    await userEvent.type(screen.getByRole('textbox'), 'hola{Enter}');
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar chat' })[0] as HTMLElement);

    act(() => transport.reply('a1', 'respuesta'));
    expect(screen.getByLabelText('1 mensajes nuevos')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar chat' })[0] as HTMLElement);
    expect(screen.queryByLabelText(/mensajes nuevos/)).toBeNull();
  });

  it('conserva la conversación al cerrar y reabrir', async () => {
    const transport = new FakeTransport();
    render(<ChatWidget transport={transport} defaultOpen />);
    await userEvent.type(screen.getByRole('textbox'), 'recuérdame{Enter}');
    act(() => transport.reply('a1', 'ok'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar chat' })[0] as HTMLElement);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(screen.getByText('recuérdame')).toBeInTheDocument();
  });

  describe('integración con MockTransport', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('flujo completo: sugerencia → streaming → Markdown renderizado', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <ChatWidget
          transport={new MockTransport({ connectDelayMs: 5, latencyMs: 50, chunkDelayMs: 1 })}
          suggestions={['Muéstrame una tabla']}
          defaultOpen
        />,
      );
      await act(async () => vi.advanceTimersByTime(10));
      expect(screen.getByTestId('connection-status')).toHaveTextContent('En línea');

      await user.click(screen.getByRole('button', { name: 'Muéstrame una tabla' }));
      expect(screen.getByRole('status', { name: /escribiendo/ })).toBeInTheDocument();

      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'Enterprise' })).toBeInTheDocument();
      expect(screen.getByTestId('message-assistant')).toHaveAttribute('data-status', 'done');
    });

    it('muestra el error del agente y permite reintentar', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <ChatWidget
          transport={new MockTransport({ connectDelayMs: 5, latencyMs: 20, chunkDelayMs: 1 })}
          defaultOpen
        />,
      );
      await act(async () => vi.advanceTimersByTime(10));
      await user.type(screen.getByRole('textbox'), 'error{Enter}');
      await act(async () => vi.advanceTimersByTime(50));

      expect(screen.getByRole('alert')).toHaveTextContent('falló a propósito');
      expect(screen.getByTestId('message-user')).toHaveAttribute('data-status', 'error');

      await user.click(screen.getByRole('button', { name: /Reintentar/ }));
      expect(screen.getAllByTestId('message-user')).toHaveLength(1);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
