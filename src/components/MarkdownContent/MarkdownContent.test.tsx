import { act, fireEvent, render, screen } from '@testing-library/react';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('renderiza formato Markdown básico', () => {
    render(
      <MarkdownContent content={'# Título\n\nTexto **negrita** y *cursiva*\n\n- uno\n- dos'} />,
    );
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('negrita').tagName).toBe('STRONG');
    expect(screen.getByText('cursiva').tagName).toBe('EM');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renderiza tablas GFM dentro de un contenedor desplazable', () => {
    const { container } = render(<MarkdownContent content={'| a | b |\n|---|---|\n| 1 | 2 |'} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.agichat-table-wrapper table')).not.toBeNull();
  });

  it('renderiza tachado y listas de tareas', () => {
    render(<MarkdownContent content={'~~viejo~~\n\n- [x] hecho\n- [ ] pendiente'} />);
    expect(screen.getByText('viejo').tagName).toBe('DEL');
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('abre los enlaces en una pestaña nueva de forma segura', () => {
    render(<MarkdownContent content="[GitHub](https://github.com)" />);
    const link = screen.getByRole('link', { name: 'GitHub' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('no interpreta HTML crudo (protección XSS)', () => {
    const { container } = render(
      <MarkdownContent content={'<img src=x onerror="alert(1)"><script>alert(1)</script>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('bloquea enlaces javascript:', () => {
    render(<MarkdownContent content="[clic](javascript:alert(1))" />);
    expect(screen.getByText('clic').closest('a')?.getAttribute('href') ?? '').not.toMatch(
      /javascript/i,
    );
  });

  describe('bloques de código', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('renderiza código y permite copiarlo', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

      render(<MarkdownContent content={'```ts\nconst a = 1;\n```'} />);
      expect(screen.getByText('const a = 1;')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
      });
      expect(writeText).toHaveBeenCalledWith('const a = 1;');
      expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1500));
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    });

    it('tolera fallos del portapapeles', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denegado'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

      render(<MarkdownContent content={'```\nx\n```'} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
      });
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    });
  });
});
