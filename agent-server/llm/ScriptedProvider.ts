import type { LlmProvider, LlmRequest, LlmResponse, ToolCall } from './LlmProvider.ts';

/**
 * Proveedor determinista: responde según un guion en vez de llamar a un modelo real.
 * Se usa en los tests y en las evals sin red, para verificar el comportamiento del sistema
 * (guardias, orquestación, herramientas) de forma reproducible y sin costo.
 */
export type Script = (request: LlmRequest, call: number) => LlmResponse | Promise<LlmResponse>;

export class ScriptedProvider implements LlmProvider {
  readonly name = 'scripted';
  readonly requests: LlmRequest[] = [];
  private readonly script: Script;

  constructor(script: Script | LlmResponse[]) {
    this.script = Array.isArray(script) ? queue(script) : script;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    // Copia superficial: el historial puede mutar después de la llamada.
    this.requests.push({ ...request, messages: [...request.messages] });
    return this.script(request, this.requests.length - 1);
  }
}

function queue(responses: LlmResponse[]): Script {
  return (_request, call) => {
    const response = responses[call];
    if (!response) throw new Error(`El guion no tiene respuesta para la llamada ${call + 1}.`);
    return response;
  };
}

export function textResponse(text: string): LlmResponse {
  return { text, toolCalls: [], stopReason: 'end' };
}

let callCounter = 0;

export function toolResponse(
  ...calls: Array<{ name: string; input?: Record<string, unknown> }>
): LlmResponse {
  const toolCalls: ToolCall[] = calls.map((call) => ({
    id: `call_${++callCounter}`,
    name: call.name,
    input: call.input ?? {},
  }));
  return { text: '', toolCalls, stopReason: 'tool_use' };
}

/** Último mensaje de usuario (texto) de la solicitud. Útil para guiones que dependen de la entrada. */
export function lastUserText(request: LlmRequest): string {
  for (let index = request.messages.length - 1; index >= 0; index -= 1) {
    const message = request.messages[index];
    if (message?.role === 'user') return message.content;
  }
  return '';
}
