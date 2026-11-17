// @vitest-environment node
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpToolbox, type McpServerSpec } from './McpToolbox.ts';

function server(name: string, tools: string[]): McpServer {
  const mcp = new McpServer({ name, version: '1.0.0' });
  for (const tool of tools) {
    mcp.registerTool(
      tool,
      { description: `desc ${tool}`, inputSchema: { q: z.string().optional() } },
      async ({ q }) =>
        q === 'falla'
          ? { content: [{ type: 'text', text: 'error' }], isError: true }
          : {
              content: [{ type: 'text', text: `${tool}:${q ?? ''}` }],
              structuredContent: { tool, q: q ?? null },
            },
    );
  }
  return mcp;
}

async function spec(name: string, tools: string[]): Promise<McpServerSpec> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server(name, tools).connect(serverTransport);
  return { name, transport: clientTransport };
}

describe('McpToolbox', () => {
  it('descubre herramientas de varios servidores y enruta las llamadas', async () => {
    const toolbox = await McpToolbox.connect([
      await spec('tmdb', ['search_movies', 'get_movie_details']),
      await spec('books', ['search_books']),
    ]);

    expect(toolbox.definitions().map((tool) => tool.name)).toEqual([
      'search_movies',
      'get_movie_details',
      'search_books',
    ]);
    expect(toolbox.definitions(['search_books', 'no_existe'])).toEqual([
      expect.objectContaining({ name: 'search_books', description: 'desc search_books' }),
    ]);
    expect(toolbox.definitions()[0]?.inputSchema).toMatchObject({ type: 'object' });
    expect(toolbox.has('search_movies')).toBe(true);

    expect(await toolbox.call('search_books', { q: 'dune' })).toEqual({
      content: 'search_books:dune',
      isError: false,
      structured: { tool: 'search_books', q: 'dune' },
      server: 'books',
    });
    expect(await toolbox.call('search_movies', { q: 'falla' })).toMatchObject({
      isError: true,
      structured: null,
      server: 'tmdb',
    });
    await toolbox.close();
  });

  it('responde con error si la herramienta no existe', async () => {
    const toolbox = await McpToolbox.connect([await spec('tmdb', ['search_movies'])]);
    expect(await toolbox.call('borrar_todo', {})).toMatchObject({ isError: true });
    await toolbox.close();
  });

  it('rechaza nombres de herramientas duplicados', async () => {
    await expect(
      McpToolbox.connect([await spec('a', ['search']), await spec('b', ['search'])]),
    ).rejects.toThrow(/duplicada/);
  });

  it('cierra las conexiones abiertas si un servidor falla al conectar', async () => {
    const good = await spec('a', ['x']);
    const broken: McpServerSpec = {
      name: 'roto',
      transport: {
        start: async () => {
          throw new Error('no arranca');
        },
        send: async () => undefined,
        close: async () => undefined,
      },
    };
    await expect(McpToolbox.connect([good, broken])).rejects.toThrow(/no arranca/);
  });
});
