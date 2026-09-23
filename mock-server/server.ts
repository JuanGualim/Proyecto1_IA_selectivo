import { createMockServer } from './createMockServer.ts';

const port = Number(process.env.PORT ?? 8787);
const server = await createMockServer({ port });

console.log(`🤖 Servidor mock de AGIChat escuchando en ws://127.0.0.1:${server.port}`);

const shutdown = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
