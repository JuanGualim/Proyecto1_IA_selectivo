import {
  toAssistantMessage,
  type LlmMessage,
  type LlmProvider,
  type StopReason,
  type ToolCall,
  type ToolDefinition,
  type ToolResult,
} from '../llm/LlmProvider.ts';

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

export interface ExecutedToolCall extends ToolCall {
  outcome: ToolOutcome;
}

export interface AgentLoopOptions {
  provider: LlmProvider;
  system: string;
  messages: LlmMessage[];
  tools: ToolDefinition[];
  executeTool: (call: ToolCall) => Promise<ToolOutcome>;
  /** Máximo de idas y vueltas con el modelo (evita bucles infinitos y costos). Por defecto 6. */
  maxSteps?: number;
  maxTokens?: number;
}

export interface AgentLoopResult {
  text: string;
  stopReason: StopReason | 'max_steps';
  /** Historial completo, incluidas las llamadas a herramientas. */
  messages: LlmMessage[];
  toolCalls: ExecutedToolCall[];
  steps: number;
}

/**
 * Bucle agéntico genérico: pide una respuesta al modelo, ejecuta las herramientas que
 * solicite (en paralelo), le devuelve los resultados y repite hasta que responda con texto.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const { provider, system, tools, executeTool, maxSteps = 6, maxTokens } = options;
  const messages = [...options.messages];
  const executed: ExecutedToolCall[] = [];

  for (let step = 1; step <= maxSteps; step += 1) {
    const response = await provider.complete({ system, messages, tools, maxTokens });
    messages.push(toAssistantMessage(response));

    // Con max_tokens la entrada de una herramienta puede venir truncada: no se ejecuta.
    if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) {
      return {
        text: response.text,
        stopReason: response.stopReason,
        messages,
        toolCalls: executed,
        steps: step,
      };
    }

    const results = await Promise.all(
      response.toolCalls.map(async (call): Promise<ToolResult> => {
        const outcome = await safeExecute(executeTool, call);
        executed.push({ ...call, outcome });
        return { toolCallId: call.id, content: outcome.content, isError: outcome.isError };
      }),
    );
    // Todos los resultados de un paso van juntos en un solo mensaje.
    messages.push({ role: 'tool_results', results });
  }

  return { text: '', stopReason: 'max_steps', messages, toolCalls: executed, steps: maxSteps };
}

async function safeExecute(
  executeTool: AgentLoopOptions['executeTool'],
  call: ToolCall,
): Promise<ToolOutcome> {
  try {
    return await executeTool(call);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    return { content: `La herramienta ${call.name} falló: ${message}`, isError: true };
  }
}
