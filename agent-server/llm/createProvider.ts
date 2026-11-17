import type { LlmConfig } from '../config.ts';
import { AnthropicProvider } from './AnthropicProvider.ts';
import type { LlmProvider } from './LlmProvider.ts';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.ts';
import { RetryingProvider, type RetryOptions } from './RetryingProvider.ts';
import { ScriptedProvider, textResponse } from './ScriptedProvider.ts';

export const SCRIPTED_REPLY =
  'Estoy en **modo sin modelo** (`LLM_PROVIDER=scripted`): la conexión y las guardias funcionan, pero no puedo razonar. Configura `GROQ_API_KEY` para activar al agente.';

/** Crea el adaptador de LLM según la configuración (lo usan el servidor y las evals). */
export function createProvider(config: LlmConfig, retry: RetryOptions = {}): LlmProvider {
  switch (config.provider) {
    case 'groq':
    case 'openai-compatible':
      // Los planes gratuitos tienen límites por minuto: se reintenta con espera.
      return new RetryingProvider(
        new OpenAICompatibleProvider({
          apiKey: config.apiKey ?? '',
          baseUrl: config.baseUrl,
          model: config.model,
        }),
        retry,
      );
    case 'anthropic':
      // El SDK de Anthropic ya reintenta los errores 429 y 5xx.
      return new AnthropicProvider({
        model: config.model,
        effort: config.effort,
        apiKey: config.apiKey,
      });
    case 'scripted':
      return new ScriptedProvider(() => textResponse(SCRIPTED_REPLY));
  }
}

/** Nombre legible del proveedor y modelo, para registros y reportes. */
export function describeProvider(config: LlmConfig): string {
  return config.provider === 'scripted' ? 'scripted' : `${config.provider} · ${config.model}`;
}
