// @vitest-environment node
import { ConfigError, loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('usa valores por defecto razonables', () => {
    expect(loadConfig({ TMDB_API_KEY: 'k' })).toEqual({
      port: 8788,
      host: '127.0.0.1',
      allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      assistantName: 'Sofía',
      llm: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'low', apiKey: undefined },
      rateLimitPerMinute: 12,
    });
  });

  it('lee la configuración del entorno', () => {
    const config = loadConfig({
      TMDB_API_KEY: 'k',
      AGENT_PORT: '9000',
      AGENT_HOST: '0.0.0.0',
      AGENT_ALLOWED_ORIGINS: 'https://maxine.dev, ,https://demo.dev',
      AGENT_ASSISTANT_NAME: 'Max',
      LLM_PROVIDER: 'scripted',
      LLM_MODEL: 'claude-haiku-5-5',
      LLM_EFFORT: 'medium',
      ANTHROPIC_API_KEY: 'sk-ant-x',
      AGENT_RATE_LIMIT_PER_MINUTE: '5',
    });
    expect(config).toMatchObject({
      port: 9000,
      host: '0.0.0.0',
      allowedOrigins: ['https://maxine.dev', 'https://demo.dev'],
      assistantName: 'Max',
      llm: {
        provider: 'scripted',
        model: 'claude-haiku-5-5',
        effort: 'medium',
        apiKey: 'sk-ant-x',
      },
      rateLimitPerMinute: 5,
    });
  });

  it.each([
    [{}, /TMDB_API_KEY/],
    [{ TMDB_API_KEY: 'k', LLM_PROVIDER: 'gpt' }, /LLM_PROVIDER/],
    [{ TMDB_API_KEY: 'k', LLM_EFFORT: 'max' }, /LLM_EFFORT/],
    [{ TMDB_API_KEY: 'k', AGENT_PORT: '99999' }, /Puerto/],
  ])('rechaza configuraciones inválidas %#', (env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
