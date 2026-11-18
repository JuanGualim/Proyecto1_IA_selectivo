import { act, renderHook } from '@testing-library/react';
import { FakeTransport } from '../test/FakeTransport';
import { openInNewTab, useChat } from './useChat';

function setup() {
  const transport = new FakeTransport();
  const hook = renderHook(({ t }) => useChat(t), { initialProps: { t: transport } });
  return { transport, ...hook };
}

describe('useChat', () => {
  it('conecta al montar y desconecta al desmontar', () => {
    const { transport, result, unmount } = setup();
    expect(transport.connectCalls).toBe(1);
    expect(result.current.connection).toBe('open');
    unmount();
    expect(transport.disconnectCalls).toBe(1);
  });

  it('reconecta si cambia el transporte', () => {
    const { transport, rerender, result } = setup();
    const other = new FakeTransport();
    other.autoOpen = false;
    rerender({ t: other });
    expect(transport.disconnectCalls).toBe(1);
    expect(other.connectCalls).toBe(1);
    expect(result.current.connection).toBe('idle');
  });

  it('envía mensajes y recibe la respuesta', () => {
    const { transport, result } = setup();
    act(() => result.current.sendMessage('  hola  '));
    expect(transport.sent[0]).toMatchObject({ type: 'user_message', content: 'hola' });
    expect(result.current.isResponding).toBe(true);

    act(() => transport.reply('a1', '**hola**'));
    expect(result.current.messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'hola', 'done'],
      ['assistant', '**hola**', 'done'],
    ]);
    expect(result.current.isResponding).toBe(false);
  });

  it('ignora mensajes vacíos y envíos mientras responde', () => {
    const { transport, result } = setup();
    act(() => result.current.sendMessage('   '));
    expect(transport.sent).toHaveLength(0);
    act(() => result.current.sendMessage('uno'));
    act(() => result.current.sendMessage('dos'));
    expect(transport.sent).toHaveLength(1);
  });

  it('marca el mensaje como fallido si el transporte lanza', () => {
    const { transport, result } = setup();
    transport.failOnSend = new Error('sin red');
    act(() => result.current.sendMessage('hola'));
    expect(result.current.messages[0]?.status).toBe('error');
    expect(result.current.error).toBe('sin red');
  });

  it('usa un mensaje genérico si el error no es una instancia de Error', () => {
    const { transport, result } = setup();
    transport.failOnSend = 'raro' as unknown as Error;
    act(() => result.current.sendMessage('hola'));
    expect(result.current.error).toBe('No se pudo enviar el mensaje.');
  });

  it('reintenta un mensaje fallido reemplazándolo', () => {
    const { transport, result } = setup();
    transport.failOnSend = new Error('sin red');
    act(() => result.current.sendMessage('hola'));
    const failedId = result.current.messages[0]?.id as string;

    transport.failOnSend = null;
    act(() => result.current.retry(failedId));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({ content: 'hola', status: 'sending' });
    expect(transport.sent).toHaveLength(1);
  });

  it('no reintenta mensajes inexistentes o que no fallaron', () => {
    const { transport, result } = setup();
    act(() => result.current.sendMessage('hola'));
    act(() => transport.reply('a1', 'ok'));
    act(() => result.current.retry('no-existe'));
    act(() => result.current.retry(result.current.messages[0]?.id as string));
    expect(transport.sent).toHaveLength(1);
  });

  it('refleja cambios de conexión y errores del servidor', () => {
    const { transport, result } = setup();
    act(() => transport.changeStatus('connecting'));
    expect(result.current.connection).toBe('connecting');
    act(() => transport.serverEmit({ type: 'error', message: 'caído' }));
    expect(result.current.error).toBe('caído');
    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it('limpia la conversación', () => {
    const { transport, result } = setup();
    act(() => result.current.sendMessage('hola'));
    act(() => transport.reply('a1', 'ok'));
    act(() => result.current.clear());
    expect(result.current.messages).toHaveLength(0);
  });

  it('acepta mensajes iniciales', () => {
    const transport = new FakeTransport();
    const { result } = renderHook(() =>
      useChat(transport, [
        { id: 'x', role: 'assistant', content: 'previo', createdAt: 1, status: 'done' },
      ]),
    );
    expect(result.current.messages).toHaveLength(1);
  });

  describe('apertura de sitios de referencia', () => {
    const IMDB = 'https://www.imdb.com/title/tt1160419/';

    function setupWithOpener(openUrl: (url: string) => boolean) {
      const transport = new FakeTransport();
      const hook = renderHook(() => useChat(transport, [], { openUrl }));
      act(() => hook.result.current.sendMessage('ábreme IMDb'));
      act(() => transport.serverEmit({ type: 'message_start', id: 'a1' }));
      return { transport, ...hook };
    }

    it('abre la pestaña sin clic y marca el enlace como abierto', () => {
      const openUrl = vi.fn(() => true);
      const { transport, result } = setupWithOpener(openUrl);

      act(() => transport.serverEmit({ type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' }));
      act(() => transport.serverEmit({ type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' }));

      expect(openUrl).toHaveBeenCalledTimes(1);
      expect(openUrl).toHaveBeenCalledWith(IMDB);
      expect(result.current.messages[1]?.links).toEqual([
        { url: IMDB, label: 'IMDb', status: 'opened' },
      ]);
    });

    it('marca el enlace como bloqueado si el navegador impide la ventana', () => {
      const { transport, result } = setupWithOpener(() => false);
      act(() => transport.serverEmit({ type: 'open_url', id: 'a1', url: IMDB, label: 'IMDb' }));
      expect(result.current.messages[1]?.links?.[0]?.status).toBe('blocked');
    });

    it('no abre URLs fuera de la lista ni las que ya abrió el servidor', () => {
      const openUrl = vi.fn(() => true);
      const { transport } = setupWithOpener(openUrl);
      act(() =>
        transport.serverEmit({ type: 'open_url', id: 'a1', url: 'https://evil.test', label: 'x' }),
      );
      act(() =>
        transport.serverEmit({
          type: 'open_url',
          id: 'a1',
          url: IMDB,
          label: 'IMDb',
          openedByServer: true,
        }),
      );
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('openInNewTab abre con window.open y corta window.opener', () => {
      const tab = { opener: 'padre' } as unknown as Window;
      const open = vi.spyOn(window, 'open').mockReturnValueOnce(tab).mockReturnValueOnce(null);
      expect(openInNewTab(IMDB)).toBe(true);
      expect(tab.opener).toBeNull();
      expect(openInNewTab(IMDB)).toBe(false);
      expect(open).toHaveBeenCalledWith(IMDB, '_blank');
      open.mockRestore();
    });
  });
});
