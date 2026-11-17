// @vitest-environment node
import type { LlmConfig } from '../config.ts';
import { AnthropicProvider } from './AnthropicProvider.ts';
import { createProvider, describeProvider, SCRIPTED_REPLY } from './createProvider.ts';
import { RetryingProvider } from './RetryingProvider.ts';

const config = (overrides: Partial<LlmConfig>): LlmConfig => ({
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  effort: 'low',
  apiKey: 'gsk_x',
  baseUrl: 'https://api.groq.com/openai/v1',
  ...overrides,
});

describe('createProvider', () => {
  it('Groq y openai-compatible usan el adaptador compatible con reintentos', () => {
    const groq = createProvider(config({}));
    expect(groq).toBeInstanceOf(RetryingProvider);
    expect(groq.name).toBe('openai-compatible');
    expect(createProvider(config({ provider: 'openai-compatible' }))).toBeInstanceOf(
      RetryingProvider,
    );
  });

  it('Anthropic usa el SDK oficial', () => {
    expect(
      createProvider(config({ provider: 'anthropic', apiKey: 'sk-ant', baseUrl: undefined })),
    ).toBeInstanceOf(AnthropicProvider);
  });

  it('scripted responde que no hay modelo configurado', async () => {
    const provider = createProvider(config({ provider: 'scripted' }));
    expect((await provider.complete({ system: 's', messages: [] })).text).toBe(SCRIPTED_REPLY);
  });

  it('falla si falta la llave del proveedor compatible', () => {
    expect(() => createProvider(config({ apiKey: undefined }))).toThrow(/LLM_API_KEY/);
  });

  it('describe el proveedor para los registros', () => {
    expect(describeProvider(config({}))).toBe('groq · openai/gpt-oss-120b');
    expect(describeProvider(config({ provider: 'scripted' }))).toBe('scripted');
  });
});
