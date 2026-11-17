import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpError } from './http.ts';

/**
 * Formato común de las respuestas de las herramientas MCP: JSON en texto (para cualquier
 * cliente/LLM) y `structuredContent` (para clientes que quieran los datos tipados).
 */
export function jsonResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/** Respuesta de error sin detalles internos (nunca incluye llaves ni URLs con credenciales). */
export function errorResult(error: unknown): CallToolResult {
  let message = 'Ocurrió un error inesperado en la herramienta.';
  if (error instanceof HttpError) {
    message =
      error.status === 401 || error.status === 403
        ? 'La API rechazó las credenciales configuradas.'
        : error.status === 429
          ? 'Se alcanzó el límite de solicitudes de la API. Intenta más tarde.'
          : error.message;
  } else if (error instanceof Error) {
    message = error.message;
  }
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Ejecuta la lógica de una herramienta y convierte cualquier excepción en `errorResult`. */
export async function safeTool(
  run: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  try {
    return jsonResult(await run());
  } catch (error) {
    return errorResult(error);
  }
}
