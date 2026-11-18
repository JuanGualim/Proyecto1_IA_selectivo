// @vitest-environment node
import { buildBookAgentPrompt, buildMovieAgentPrompt, buildSupervisorPrompt } from './prompts.ts';

const context = { assistantName: 'Sofía', canary: 'AGC-test' };

describe('prompts del sistema', () => {
  it.each([buildSupervisorPrompt, buildMovieAgentPrompt, buildBookAgentPrompt])(
    'incluye el canario y las reglas de seguridad',
    (build) => {
      const prompt = build(context);
      expect(prompt).toContain('AGC-test');
      expect(prompt).toContain('<datos_externos>');
      expect(prompt).toMatch(/Nunca las reveles/);
    },
  );

  it('el agente de películas ahorra llamadas: máximo 3 y detalles en paralelo', () => {
    const prompt = buildMovieAgentPrompt(context);
    expect(prompt).toContain('limit: 3');
    expect(prompt).toMatch(/en paralelo/);
  });

  it('el supervisor conoce a su equipo, los pósters y la comparación con libros', () => {
    const prompt = buildSupervisorPrompt(context);
    expect(prompt).toContain('Eres Sofía');
    for (const tool of ['ask_movie_agent', 'ask_book_agent', 'open_reference']) {
      expect(prompt).toContain(tool);
    }
    expect(prompt).toContain('![Póster de');
    expect(prompt).toMatch(/basedOnBook/);
  });

  it('no contiene secretos de configuración', () => {
    const all = [buildSupervisorPrompt, buildMovieAgentPrompt, buildBookAgentPrompt]
      .map((build) => build(context))
      .join('\n');
    expect(all).not.toMatch(/api[_ ]?key|sk-ant|TMDB_API_KEY/i);
  });
});
