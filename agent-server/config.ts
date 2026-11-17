import { DEFAULT_ANTHROPIC_MODEL, type Effort } from './llm/AnthropicProvider.ts';

/** Configuración del servidor del agente, leída de variables de entorno (ver `.env.example`). */
export interface AgentConfig {
  port: number;
  host: string;
  allowedOrigins: string[];
  assistantName: string;
  llm: {
    provider: 'anthropic' | 'scripted';
    model: string;
    effort: Effort;
    apiKey: string | undefined;
  };
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

function toPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`Puerto inválido: ${value}`);
  }
  return port;
}

export function loadConfig(env: Record<string, string | undefined>): AgentConfig {
  const provider = (env.LLM_PROVIDER ?? 'anthropic').trim();
  if (provider !== 'anthropic' && provider !== 'scripted') {
    throw new ConfigError(
      `LLM_PROVIDER debe ser "anthropic" o "scripted" (recibido: ${provider}).`,
    );
  }
  if (!env.TMDB_API_KEY) {
    throw new ConfigError(
      'Falta TMDB_API_KEY. Copia .env.example a .env y agrega tu llave de The Movie Database.',
    );
  }
  const effort = (env.LLM_EFFORT ?? 'low') as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new ConfigError(`LLM_EFFORT debe ser low, medium o high (recibido: ${effort}).`);
  }

  return {
    port: toPort(env.AGENT_PORT, 8788),
    host: env.AGENT_HOST || '127.0.0.1',
    allowedOrigins: (env.AGENT_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    assistantName: env.AGENT_ASSISTANT_NAME || 'Sofía',
    llm: {
      provider,
      model: env.LLM_MODEL || DEFAULT_ANTHROPIC_MODEL,
      effort,
      apiKey: env.ANTHROPIC_API_KEY || undefined,
    },
    rateLimitPerMinute: Number(env.AGENT_RATE_LIMIT_PER_MINUTE) || 12,
  };
}
