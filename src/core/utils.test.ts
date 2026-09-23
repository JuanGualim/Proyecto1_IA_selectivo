import { STATUS_LABELS, formatTime } from './format';
import { createId } from './id';

describe('createId', () => {
  it('genera ids únicos con prefijo', () => {
    const a = createId('x');
    const b = createId('x');
    expect(a).toMatch(/^x_/);
    expect(a).not.toBe(b);
  });

  it('usa un respaldo cuando crypto.randomUUID no existe', () => {
    vi.stubGlobal('crypto', undefined);
    try {
      const a = createId();
      const b = createId();
      expect(a).toMatch(/^msg_/);
      expect(a).not.toBe(b);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('format', () => {
  it('formatea la hora como HH:MM', () => {
    const date = new Date(2026, 0, 1, 9, 5);
    expect(formatTime(date.getTime())).toBe('09:05');
  });

  it('tiene una etiqueta para cada estado', () => {
    expect(Object.keys(STATUS_LABELS)).toEqual(['idle', 'connecting', 'open', 'closed', 'error']);
  });
});
