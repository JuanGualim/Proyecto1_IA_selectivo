import type { LlmProvider, ToolDefinition } from '../llm/LlmProvider.ts';
import type { ToolCallOutcome } from '../mcp/McpToolbox.ts';
import { prepareToolOutput } from '../security/externalContent.ts';
import { buildBookAgentPrompt, buildMovieAgentPrompt, type PromptContext } from './prompts.ts';
import { runAgentLoop } from './runAgentLoop.ts';
import type { TurnContext } from './TurnContext.ts';

/** Lo que los agentes necesitan de un catálogo de herramientas (lo implementa McpToolbox). */
export interface ToolExecutor {
  definitions(names?: readonly string[]): ToolDefinition[];
  call(name: string, input: Record<string, unknown>): Promise<ToolCallOutcome>;
}

export interface SpecialistDefinition {
  name: string;
  /** Herramientas MCP que puede usar (mínimo privilegio: nadie más que el supervisor navega). */
  tools: readonly string[];
  buildPrompt: (context: PromptContext) => string;
}

export const MOVIE_SPECIALIST: SpecialistDefinition = {
  name: 'movie_agent',
  tools: ['search_movies', 'recommend_movies', 'get_movie_details', 'list_genres'],
  buildPrompt: buildMovieAgentPrompt,
};

export const BOOK_SPECIALIST: SpecialistDefinition = {
  name: 'book_agent',
  tools: [
    'search_movies',
    'get_movie_details',
    'find_book_for_movie',
    'search_books',
    'get_book_details',
  ],
  buildPrompt: buildBookAgentPrompt,
};

export interface SpecialistDeps {
  provider: LlmProvider;
  tools: ToolExecutor;
  prompt: PromptContext;
  maxSteps?: number;
}

/**
 * Ejecuta un especialista sobre una tarea delegada por el supervisor. Cada resultado de
 * herramienta se registra en el contexto (datos estructurados) y se sanitiza antes de que el
 * modelo lo lea (defensa contra inyección indirecta).
 */
export async function runSpecialist(
  definition: SpecialistDefinition,
  task: string,
  deps: SpecialistDeps,
  context: TurnContext,
): Promise<string> {
  const allowed = new Set(definition.tools);
  const result = await runAgentLoop({
    provider: deps.provider,
    system: definition.buildPrompt(deps.prompt),
    messages: [{ role: 'user', content: task }],
    tools: deps.tools.definitions(definition.tools),
    maxSteps: deps.maxSteps ?? 6,
    executeTool: async (call) => {
      // Aunque el modelo invente una herramienta fuera de su lista, no se ejecuta.
      if (!allowed.has(call.name)) {
        return {
          content: `La herramienta ${call.name} no está disponible para ti.`,
          isError: true,
        };
      }
      context.toolCalls += 1;
      const outcome = await deps.tools.call(call.name, call.input);
      if (!outcome.isError) context.record(outcome.structured);
      const prepared = prepareToolOutput(outcome.server || definition.name, outcome.content);
      if (prepared.flagged) context.indirectInjection = true;
      return { content: prepared.content, isError: outcome.isError };
    },
  });

  if (result.stopReason === 'max_steps' || !result.text) {
    return 'El especialista no logró completar la tarea con la información disponible.';
  }
  return result.text;
}
