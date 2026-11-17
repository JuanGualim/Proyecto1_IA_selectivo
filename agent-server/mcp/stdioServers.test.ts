// @vitest-environment node
import { existsSync } from 'node:fs';
import { createStdioSpecs, stdioServerParams } from './stdioServers.ts';

const ENV = {
  TMDB_API_KEY: 'tmdb-secret',
  TMDB_LANGUAGE: 'es-MX',
  GOOGLE_BOOKS_API_KEY: 'books-secret',
  ANTHROPIC_API_KEY: 'llm-secret',
};

describe('stdioServerParams', () => {
  it('lanza los tres servidores MCP con Node', () => {
    const servers = stdioServerParams(ENV, { PATH: '/bin' });
    expect(servers.map((server) => server.name)).toEqual(['tmdb', 'books', 'navigator']);
    for (const { params } of servers) {
      expect(params.command).toBe(process.execPath);
      expect(existsSync(params.args?.[0] ?? '')).toBe(true);
    }
  });

  it('entrega a cada servidor solo sus credenciales', () => {
    const [tmdb, books, navigator] = stdioServerParams(ENV, { PATH: '/bin' });
    expect(tmdb?.params.env).toEqual({
      PATH: '/bin',
      TMDB_API_KEY: 'tmdb-secret',
      TMDB_LANGUAGE: 'es-MX',
    });
    expect(books?.params.env).toEqual({ PATH: '/bin', GOOGLE_BOOKS_API_KEY: 'books-secret' });
    expect(navigator?.params.env).toEqual({ PATH: '/bin' });
    const [, , withHost] = stdioServerParams({ NAVIGATOR_OPEN_ON_HOST: 'true' }, {});
    expect(withHost?.params.env).toEqual({ NAVIGATOR_OPEN_ON_HOST: 'true' });
    const all = JSON.stringify([tmdb, books, navigator]);
    expect(all).not.toContain('llm-secret');
  });

  it('omite variables vacías y crea transportes sin arrancarlos', () => {
    const [, books] = stdioServerParams({ GOOGLE_BOOKS_API_KEY: '' });
    expect(books?.params.env).not.toHaveProperty('GOOGLE_BOOKS_API_KEY');
    expect(createStdioSpecs({}).map((spec) => spec.name)).toEqual(['tmdb', 'books', 'navigator']);
  });
});
