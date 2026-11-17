import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBooksServer } from './createBooksServer.ts';
import { GoogleBooksClient } from './googleBooksClient.ts';

// Punto de entrada por stdio: `npm run mcp:books`. Los diagnósticos van a stderr.
const books = new GoogleBooksClient({ apiKey: process.env.GOOGLE_BOOKS_API_KEY });
await createBooksServer(books).connect(new StdioServerTransport());
console.error('Servidor MCP de libros listo (stdio).');
