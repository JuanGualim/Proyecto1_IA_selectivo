import { fileURLToPath } from 'node:url';
import {
  getDefaultEnvironment,
  StdioClientTransport,
  type StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerSpec } from './McpToolbox.ts';

/** Servidores MCP del proyecto y las variables de entorno que necesita cada uno. */
const SERVERS: Array<{ name: string; entry: string; envKeys: string[] }> = [
  { name: 'tmdb', entry: 'tmdb/main.ts', envKeys: ['TMDB_API_KEY', 'TMDB_LANGUAGE'] },
  { name: 'books', entry: 'books/main.ts', envKeys: ['GOOGLE_BOOKS_API_KEY'] },
  { name: 'navigator', entry: 'navigator/main.ts', envKeys: [] },
];

const MCP_ROOT = fileURLToPath(new URL('../../mcp-servers/', import.meta.url));

/**
 * Parámetros para lanzar cada servidor MCP como proceso hijo (stdio). Cada proceso recibe
 * solo sus propias credenciales (mínimo privilegio): p. ej. el servidor de libros nunca ve
 * la llave de TMDB ni la del LLM.
 */
export function stdioServerParams(
  env: Record<string, string | undefined>,
  base: Record<string, string> = getDefaultEnvironment(),
): Array<{ name: string; params: StdioServerParameters }> {
  return SERVERS.map(({ name, entry, envKeys }) => {
    const serverEnv: Record<string, string> = { ...base };
    for (const key of envKeys) {
      const value = env[key];
      if (value) serverEnv[key] = value;
    }
    return {
      name,
      params: { command: process.execPath, args: [`${MCP_ROOT}${entry}`], env: serverEnv },
    };
  });
}

export function createStdioSpecs(env: Record<string, string | undefined>): McpServerSpec[] {
  return stdioServerParams(env).map(({ name, params }) => ({
    name,
    transport: new StdioClientTransport(params),
  }));
}
