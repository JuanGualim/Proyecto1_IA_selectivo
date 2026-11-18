import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Conecta un cliente MCP a un servidor en memoria (sin procesos ni red). Solo para tests. */
export async function connectInMemory(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** Llama a una herramienta y devuelve el JSON del primer bloque de texto. */
export async function callJson(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ result: CallToolResult; data: unknown }> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];
  const text = first?.type === 'text' ? first.text : '';
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // El texto no es JSON (p. ej. un mensaje de error).
  }
  return { result, data };
}
