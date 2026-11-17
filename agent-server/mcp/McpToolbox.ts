import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ToolOutcome } from '../agents/runAgentLoop.ts';
import type { ToolDefinition } from '../llm/LlmProvider.ts';

export interface McpServerSpec {
  /** Nombre lógico del servidor (p. ej. `tmdb`). */
  name: string;
  transport: Transport;
}

export interface ToolCallOutcome extends ToolOutcome {
  /** Datos estructurados devueltos por la herramienta, si los hay. */
  structured: Record<string, unknown> | null;
  server: string;
}

interface Connection {
  name: string;
  client: Client;
}

/**
 * Cliente MCP del agente: se conecta a varios servidores MCP, descubre sus herramientas y
 * enruta cada llamada al servidor que la ofrece. Los agentes solo ven `ToolDefinition`s.
 */
export class McpToolbox {
  private readonly connections: Connection[];
  private readonly toolIndex = new Map<
    string,
    { definition: ToolDefinition; connection: Connection }
  >();

  private constructor(connections: Connection[]) {
    this.connections = connections;
  }

  static async connect(specs: McpServerSpec[]): Promise<McpToolbox> {
    const connections: Connection[] = [];
    try {
      for (const spec of specs) {
        const client = new Client({ name: `agichat-agent/${spec.name}`, version: '1.0.0' });
        await client.connect(spec.transport);
        connections.push({ name: spec.name, client });
      }
    } catch (error) {
      await Promise.allSettled(connections.map((connection) => connection.client.close()));
      throw error;
    }
    const toolbox = new McpToolbox(connections);
    await toolbox.refresh();
    return toolbox;
  }

  /** Vuelve a leer la lista de herramientas de todos los servidores. */
  async refresh(): Promise<void> {
    this.toolIndex.clear();
    for (const connection of this.connections) {
      const { tools } = await connection.client.listTools();
      for (const tool of tools) {
        if (this.toolIndex.has(tool.name)) {
          throw new Error(`La herramienta ${tool.name} está duplicada en varios servidores MCP.`);
        }
        this.toolIndex.set(tool.name, {
          connection,
          definition: {
            name: tool.name,
            description: tool.description ?? tool.title ?? tool.name,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          },
        });
      }
    }
  }

  /** Definiciones de herramientas. Con `names` devuelve solo ese subconjunto (mínimo privilegio). */
  definitions(names?: readonly string[]): ToolDefinition[] {
    const all = [...this.toolIndex.values()].map((entry) => entry.definition);
    if (!names) return all;
    return names.flatMap((name) => {
      const entry = this.toolIndex.get(name);
      return entry ? [entry.definition] : [];
    });
  }

  has(name: string): boolean {
    return this.toolIndex.has(name);
  }

  async call(name: string, input: Record<string, unknown>): Promise<ToolCallOutcome> {
    const entry = this.toolIndex.get(name);
    if (!entry) {
      return {
        content: `La herramienta ${name} no existe.`,
        isError: true,
        structured: null,
        server: '',
      };
    }
    const result = (await entry.connection.client.callTool({
      name,
      arguments: input,
    })) as CallToolResult;
    const content = result.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();
    return {
      content,
      isError: result.isError === true,
      structured: result.structuredContent ?? null,
      server: entry.connection.name,
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.connections.map((connection) => connection.client.close()));
  }
}
