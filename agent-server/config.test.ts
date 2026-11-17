// @vitest-environment node
import { ConfigError, loadConfig, loadLlmConfig } from './config.ts';

const BASE = { TMDB_API_KEY: 'k', GROQ_API_KEY: 'gsk_x' };

describe('loadConfig', () => {
  it('usa valores por defecto razonables (Groq como LLM)', () => {
    expect(loadConfig(BASE)).toEqual({
      port: 8788,
      host: '127.0.0.1',
      allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      assistantName: 'Sofía',
      llm: {
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        effort: 'low',
        apiKey: 'gsk_x',
        baseUrl: 'https://api.groq.com/openai/v1',
      },
      rateLimitPerMinute: 12,
    });
  });

  it('lee la configuración del entorno', () => {
    const config = loadConfig({
      ...BASE,
      AGENT_PORT: '9000',
      AGENT_HOST: '0.0.0.0',
      AGENT_ALLOWED_ORIGINS: 'https://maxine.dev, ,https://demo.dev',
      AGENT_ASSISTANT_NAME: 'Max',
      AGENT_RATE_LIMIT_PER_MINUTE: '5',
    });
    expect(config).toMatchObject({
      port: 9000,
      host: '0.0.0.0',
      allowedOrigins: ['https://maxine.dev', 'https://demo.dev'],
      assistantName: 'Max',
      rateLimitPerMinute: 5,
    });
  });

  it.each([
    [{}, /TMDB_API_KEY/],
    [{ ...BASE, AGENT_PORT: '99999' }, /Puerto/],
  ])('rechaza configuraciones inválidas %#', (env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});

describe('loadLlmConfig', () => {
  it('Groq acepta LLM_API_KEY y otro modelo', () => {
    expect(
      loadLlmConfig({
        LLM_PROVIDER: 'groq',
        LLM_API_KEY: 'gsk_y',
        LLM_MODEL: 'openai/gpt-oss-120b',
      }),
    ).toMatchObject({ provider: 'groq', apiKey: 'gsk_y', model: 'openai/gpt-oss-120b' });
  });

  it('openai-compatible sirve para NVIDIA, Gemini u otros', () => {
    expect(
      loadLlmConfig({
        LLM_PROVIDER: 'openai-compatible',
        LLM_BASE_URL: 'https://integrate.api.nvidia.com/v1',
        LLM_MODEL: 'meta/llama-3.3-70b-instruct',
        LLM_API_KEY: 'nvapi-x',
      }),
    ).toEqual({
      provider: 'openai-compatible',
      model: 'meta/llama-3.3-70b-instruct',
      effort: 'low',
      apiKey: 'nvapi-x',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    });
  });

  it('Anthropic y scripted usan Claude por defecto', () => {
    expect(
      loadLlmConfig({
        LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'sk-ant',
        LLM_EFFORT: 'medium',
      }),
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      effort: 'medium',
      apiKey: 'sk-ant',
      baseUrl: undefined,
    });
    expect(loadLlmConfig({ LLM_PROVIDER: 'scripted' })).toMatchObject({
      provider: 'scripted',
      apiKey: undefined,
    });
  });

  it.each([
    [{ LLM_PROVIDER: 'gpt' }, /LLM_PROVIDER/],
    [{ GROQ_API_KEY: 'x', LLM_EFFORT: 'max' }, /LLM_EFFORT/],
    [{}, /GROQ_API_KEY/],
    [{ LLM_PROVIDER: 'openai-compatible', LLM_API_KEY: 'x' }, /LLM_BASE_URL/],
  ])('rechaza configuraciones inválidas %#', (env, message) => {
    expect(() => loadLlmConfig(env)).toThrow(message);
  });
});
