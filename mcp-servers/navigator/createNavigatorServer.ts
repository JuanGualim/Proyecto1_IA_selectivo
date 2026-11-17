import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildReferenceLink, isAllowedReferenceUrl } from '../../src/core/references.ts';
import { safeTool } from '../shared/toolResult.ts';

export interface NavigatorOptions {
  /**
   * Abre la URL en la máquina donde corre el servidor (p. ej. con `xdg-open`). Si no se
   * indica, el servidor solo devuelve la acción `open_url` y el cliente decide cómo abrirla
   * (el agente de AGIChat la reenvía al widget, que abre la pestaña en el navegador del usuario).
   */
  openOnHost?: (url: string) => Promise<void>;
}

/** Servidor MCP que abre sitios de referencia (IMDb y Google Books) en una pestaña. */
export function createNavigatorServer(options: NavigatorOptions = {}): McpServer {
  const server = new McpServer({ name: 'agichat-navigator', version: '1.0.0' });

  server.registerTool(
    'open_reference',
    {
      title: 'Abrir sitio de referencia',
      description:
        'Abre en una nueva pestaña del navegador del usuario la ficha de IMDb de una película o la de Google Books de un libro. ' +
        'Pasa el id (imdbId "tt…" o volumeId de Google Books) o, si no lo conoces, un texto de búsqueda. ' +
        'Solo admite estos dos sitios; no acepta URLs.',
      inputSchema: {
        site: z.enum(['imdb', 'google_books']),
        id: z.string().max(40).optional(),
        query: z.string().max(200).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    ({ site, id, query }) =>
      safeTool(async () => {
        const link = buildReferenceLink({ site, id, query });
        // Doble verificación: nunca se abre algo fuera de la lista permitida.
        if (!link || !isAllowedReferenceUrl(link.url)) {
          throw new Error(
            'Datos insuficientes o no válidos para construir el enlace de referencia.',
          );
        }
        let openedOnHost = false;
        if (options.openOnHost) {
          await options.openOnHost(link.url);
          openedOnHost = true;
        }
        return { action: 'open_url', ...link, openedOnHost };
      }),
  );

  return server;
}
