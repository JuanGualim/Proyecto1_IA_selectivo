import { chunkText, defaultResponder } from './responder';

function content(text: string): string {
  const reply = defaultResponder(text);
  if (!('content' in reply)) throw new Error('se esperaba contenido');
  return reply.content;
}

describe('defaultResponder', () => {
  it.each([
    ['hola', '¡Hola!'],
    ['ayuda', '`tabla`'],
    ['muéstrame una tabla', '| Plan |'],
    ['dame código', '```ts'],
    ['una lista', '- [x]'],
    ['markdown', '# Encabezado'],
  ])('responde a "%s" con Markdown', (input, expected) => {
    expect(content(input)).toContain(expected);
  });

  it('simula un error', () => {
    expect(defaultResponder('provoca un error')).toEqual({ error: expect.any(String) });
  });

  it('hace eco citando el mensaje por defecto', () => {
    expect(content('algo\ncon dos líneas')).toContain('> algo\n> con dos líneas');
  });
});

describe('chunkText', () => {
  it('divide en fragmentos que reconstruyen el texto original', () => {
    const text = '  Hola   mundo\n\n**markdown** ';
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
  });

  it('maneja textos vacíos o solo con espacios', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual(['   ']);
  });
});
