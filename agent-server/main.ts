import { Orchestrator } from './agents/Orchestrator.ts';
import { ConfigError, loadConfig } from './config.ts';
import { createAgentServer } from './createAgentServer.ts';
import { AnthropicProvider } from './llm/AnthropicProvider.ts';
import type { LlmProvider } from './llm/LlmProvider.ts';
import { ScriptedProvider, textResponse } from './llm/ScriptedProvider.ts';
import { McpToolbox } from './mcp/McpToolbox.ts';
import { createStdioSpecs } from './mcp/stdioServers.ts';
import { createCanary } from './security/outputGuard.ts';

// Punto de entrada: `npm run agent-server`. Lanza los servidores MCP, crea el sistema
// multiagente y expone el WebSocket que usa el widget (WebSocketTransport).
let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const provider: LlmProvider =
  config.llm.provider === 'anthropic'
    ? new AnthropicProvider({
        model: config.llm.model,
        effort: config.llm.effort,
        apiKey: config.llm.apiKey,
      })
    : new ScriptedProvider(() =>
        textResponse(
          'Estoy en **modo sin modelo** (`LLM_PROVIDER=scripted`): la conexión y las guardias funcionan, pero no puedo razonar. Configura `ANTHROPIC_API_KEY` para activar al agente.',
        ),
      );

const toolbox = await McpToolbox.connect(createStdioSpecs(process.env));
const agent = new Orchestrator({
  provider,
  tools: toolbox,
  canary: createCanary(),
  assistantName: config.assistantName,
});
const server = await createAgentServer({
  agent,
  port: config.port,
  host: config.host,
  allowedOrigins: config.allowedOrigins,
  rateLimitPerMinute: config.rateLimitPerMinute,
});

console.error(
  `🎬 Agente de AGIChat escuchando en ws://${config.host}:${server.port} ` +
    `(LLM: ${provider.name}, herramientas MCP: ${toolbox.definitions().length})`,
);

const shutdown = () => {
  void Promise.all([server.close(), toolbox.close()]).then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
