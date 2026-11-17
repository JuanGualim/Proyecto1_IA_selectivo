// @vitest-environment node
import { HttpError } from './http.ts';
import { errorResult, jsonResult, safeTool } from './toolResult.ts';

function text(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content[0]?.text ?? '';
}

describe('resultados de herramientas', () => {
  it('jsonResult incluye texto JSON y contenido estructurado', () => {
    const result = jsonResult({ a: 1 });
    expect(text(result)).toBe('{"a":1}');
    expect(result.structuredContent).toEqual({ a: 1 });
  });

  it.each([
    [new HttpError(401, 'x'), /credenciales/],
    [new HttpError(403, 'x'), /credenciales/],
    [new HttpError(429, 'x'), /límite/],
    [new HttpError(500, 'La API respondió 500.'), /500/],
    [new Error('fallo propio'), /fallo propio/],
    ['raro', /inesperado/],
  ])('errorResult traduce %s a un mensaje seguro', (error, expected) => {
    const result = errorResult(error);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(expected);
  });

  it('safeTool convierte excepciones en errores de herramienta', async () => {
    expect((await safeTool(async () => ({ ok: true }))).isError).toBeUndefined();
    const failed = await safeTool(async () => {
      throw new Error('boom');
    });
    expect(failed.isError).toBe(true);
  });
});
