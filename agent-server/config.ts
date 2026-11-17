import { DEFAULT_ANTHROPIC_MODEL, type Effort } from './llm/AnthropicProvider.ts';
import { DEFAULT_GROQ_MODEL, GROQ_BASE_URL } from './llm/OpenAICompatibleProvider.ts';

export type LlmProviderName = 'groq' | 'openai-compatible' | 'anthropic' | 'scripted';

/** Configuración del modelo de lenguaje (la usan el servidor y las evals en vivo). */
export interface LlmConfig {
  provider: LlmProviderName;
  model: string;
  effort: Effort;
  apiKey: string | undefined;
  /** URL de la API compatible con OpenAI (Groq, NVIDIA, Gemini, …). */
  baseUrl: string | undefined;
}

/** Configuración del servidor del agente, leída de variables de entorno (ver `.env.example`). */
export interface AgentConfig {
  port: number;
  host: string;
  allowedOrigins: string[];
  assistantName: string;
  llm: LlmConfig;
  /** Mensajes por minuto permitidos por conexión. */
  rateLimitPerMinute: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const EFFORTS: Effort[] = ['low', 'medium', 'high'];
const PROVIDERS: LlmProviderName[] = ['groq', 'openai-compatible', 'anthropic', 'scripted'];

function toPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`Puerto inválido: ${value}`);
  }
  return port;
}

/**
 * Lee la configuración del LLM. Por defecto usa Groq (plan gratuito, API compatible con
 * OpenAI); `openai-compatible` sirve para NVIDIA NIM, Gemini, OpenRouter, Cerebras u Ollama.
 */
export function loadLlmConfig(env: Record<string, string | undefined>): LlmConfig {
  const provider = (env.LLM_PROVIDER ?? 'groq').trim() as LlmProviderName;
  if (!PROVIDERS.includes(provider)) {
    throw new ConfigError(`LLM_PROVIDER debe ser ${PROVIDERS.join(', ')} (recibido: ${provider}).`);
  }
  const effort = (env.LLM_EFFORT ?? 'low') as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new ConfigError(`LLM_EFFORT debe ser low, medium o high (recibido: ${effort}).`);
  }

  switch (provider) {
    case 'groq': {
      const apiKey = env.GROQ_API_KEY || env.LLM_API_KEY;
      if (!apiKey) {
        throw new ConfigError(
          'Falta GROQ_API_KEY. Crea una llave gratis en https://console.groq.com/keys y agrégala a .env.',
        );
      }
      return {
        provider,
        model: env.LLM_MODEL || DEFAULT_GROQ_MODEL,
        effort,
        apiKey,
        baseUrl: env.LLM_BASE_URL || GROQ_BASE_URL,
      };
    }
    case 'openai-compatible': {
      if (!env.LLM_BASE_URL || !env.LLM_MODEL || !env.LLM_API_KEY) {
        throw new ConfigError(
          'Con LLM_PROVIDER=openai-compatible debes definir LLM_BASE_URL, LLM_MODEL y LLM_API_KEY.',
        );
      }
      return {
        provider,
        model: env.LLM_MODEL,
        effort,
        apiKey: env.LLM_API_KEY,
        baseUrl: env.LLM_BASE_URL,
      };
    }
    case 'anthropic':
    case 'scripted':
      return {
        provider,
        model: env.LLM_MODEL || DEFAULT_ANTHROPIC_MODEL,
        effort,
        apiKey: env.ANTHROPIC_API_KEY || undefined,
        baseUrl: undefined,
      };
  }
}

export function loadConfig(env: Record<string, string | undefined>): AgentConfig {
  if (!env.TMDB_API_KEY) {
    throw new ConfigError(
      'Falta TMDB_API_KEY. Copia .env.example a .env y agrega tu llave de The Movie Database.',
    );
  }

  return {
    port: toPort(env.AGENT_PORT, 8788),
    host: env.AGENT_HOST || '127.0.0.1',
    allowedOrigins: (env.AGENT_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    assistantName: env.AGENT_ASSISTANT_NAME || 'Sofía',
    llm: loadLlmConfig(env),
    rateLimitPerMinute: Number(env.AGENT_RATE_LIMIT_PER_MINUTE) || 12,
  };
}
