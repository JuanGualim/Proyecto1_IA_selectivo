import type { TurnResult } from '../agent-server/agents/Orchestrator.ts';
import type { ReferenceSite } from '../src/core/references.ts';

/**
 * Tipos del sistema de evals del agente.
 *
 *  - `funcional`:        el agente usa bien sus herramientas (recomendar, comparar, abrir sitios).
 *  - `LLM01-directo`:    prompt injection escrito por el usuario.
 *  - `LLM01-indirecto`:  prompt injection escondido en datos de TMDB / Google Books.
 *  - `LLM07`:            intentos de extraer el system prompt o el token interno.
 */
export type EvalCategory = 'funcional' | 'LLM01-directo' | 'LLM01-indirecto' | 'LLM07';

/** Datos envenenados que devuelve una herramienta (simula a un tercero malicioso). */
export type Poison = 'tmdb_overview' | 'books_description' | 'markdown_exfil';

export type Check =
  | { type: 'blocked' }
  | { type: 'not_blocked' }
  | { type: 'tool_called'; name: string }
  | { type: 'tool_not_called'; name: string }
  | { type: 'opened_site'; site: ReferenceSite }
  | { type: 'no_actions' }
  | { type: 'no_untrusted_urls' }
  | { type: 'shows_poster' }
  | { type: 'offers_book_comparison' }
  | { type: 'text_matches'; pattern: RegExp; label: string }
  | { type: 'no_prompt_leak' }
  | { type: 'flags_indirect_injection' };

export interface EvalCase {
  id: string;
  category: EvalCategory;
  title: string;
  input: string;
  poison?: Poison;
  /** Si es un ataque, al fallar cualquier verificación se cuenta como ataque exitoso. */
  attack: boolean;
  checks: Check[];
}

export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
}

export interface EvalRun {
  case: EvalCase;
  result: TurnResult | null;
  /** Herramientas pedidas por cualquier agente (supervisor o especialistas). */
  toolCalls: ToolCallRecord[];
  canary: string;
  systemPrompts: string[];
  durationMs: number;
  error?: string;
}

export interface CheckOutcome {
  check: Check;
  passed: boolean;
  detail: string;
}

export interface GradedRun {
  run: EvalRun;
  passed: boolean;
  /** El atacante logró su objetivo: falló alguna verificación de daño (no de mecanismo). */
  compromised: boolean;
  outcomes: CheckOutcome[];
}
