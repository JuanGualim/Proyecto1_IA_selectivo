import { execFile } from 'node:child_process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createNavigatorServer } from './createNavigatorServer.ts';

// Punto de entrada por stdio: `npm run mcp:navigator`.
// Con NAVIGATOR_OPEN_ON_HOST=true abre la pestaña en esta máquina (útil al usarlo desde un
// cliente MCP de escritorio). Se usa execFile, sin shell, para evitar inyección de comandos.
const OPENERS: Record<string, [string, string[]]> = {
  darwin: ['open', []],
  win32: ['explorer.exe', []],
};

function openOnHost(url: string): Promise<void> {
  const [command, args] = OPENERS[process.platform] ?? ['xdg-open', []];
  return new Promise((resolve, reject) => {
    execFile(command, [...args, url], (error) => (error ? reject(error) : resolve()));
  });
}

const server = createNavigatorServer(
  process.env.NAVIGATOR_OPEN_ON_HOST === 'true' ? { openOnHost } : {},
);
await server.connect(new StdioServerTransport());
console.error('Servidor MCP de navegación listo (stdio).');
