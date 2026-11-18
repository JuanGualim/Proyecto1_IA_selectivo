import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTmdbServer } from './createTmdbServer.ts';
import { TmdbClient } from './tmdbClient.ts';

// Punto de entrada por stdio: `npm run mcp:tmdb`. stdout queda reservado al protocolo MCP,
// por eso los mensajes de diagnóstico van a stderr.
const tmdb = new TmdbClient({
  apiKey: process.env.TMDB_API_KEY ?? '',
  language: process.env.TMDB_LANGUAGE,
});
await createTmdbServer(tmdb).connect(new StdioServerTransport());
console.error('Servidor MCP de TMDB listo (stdio).');
