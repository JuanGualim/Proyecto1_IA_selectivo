import { useMemo, useState } from 'react';
import {
  ChatWidget,
  MockTransport,
  WebSocketTransport,
  type ChatTransport,
  type ChatWidgetPosition,
  type ChatWidgetTheme,
} from '../src';

type TransportKind = 'mock' | 'websocket';

const DEFAULT_WS_URL = 'ws://127.0.0.1:8787';
const SUGGESTIONS = ['Hola', 'Muéstrame una tabla', 'Dame código', 'markdown'];
const COLORS = ['#6d4aff', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b'];

function readInitialTransport(): TransportKind {
  const params = new URLSearchParams(window.location.search);
  return params.get('transport') === 'websocket' ? 'websocket' : 'mock';
}

/** Página de ejemplo que simula el sitio de un cliente de AGIChat usando el SDK. */
export function DemoApp() {
  const [kind, setKind] = useState<TransportKind>(readInitialTransport);
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [wsUrlDraft, setWsUrlDraft] = useState(DEFAULT_WS_URL);
  const [theme, setTheme] = useState<ChatWidgetTheme>('light');
  const [position, setPosition] = useState<ChatWidgetPosition>('bottom-right');
  const [color, setColor] = useState(COLORS[0] as string);

  // Cambiar de adaptador es lo único necesario para pasar del mock al agente real.
  const transport = useMemo<ChatTransport>(
    () => (kind === 'mock' ? new MockTransport() : new WebSocketTransport({ url: wsUrl })),
    [kind, wsUrl],
  );

  return (
    <div className="demo">
      <header className="demo__nav">
        <span className="demo__logo">
          AGI<strong>Chat</strong>
        </span>
        <span className="demo__tag">SDK demo · Fase 1</span>
      </header>

      <main className="demo__hero">
        <h1>
          Añade un agente de IA a tu producto <span>en minutos</span>
        </h1>
        <p>
          Esta página simula el sitio de un cliente que integró el widget de AGIChat. Abre el chat
          en la esquina inferior y prueba escribir <code>ayuda</code>, <code>tabla</code>,{' '}
          <code>código</code> o <code>error</code>.
        </p>

        <section className="demo__panel" aria-label="Configuración del widget">
          <h2>Configura el widget</h2>

          <label>
            Backend
            <select value={kind} onChange={(e) => setKind(e.target.value as TransportKind)}>
              <option value="mock">Mock en el navegador (MockTransport)</option>
              <option value="websocket">WebSocket (npm run mock-server)</option>
            </select>
          </label>

          {kind === 'websocket' && (
            <label>
              URL del WebSocket
              <input
                value={wsUrlDraft}
                onChange={(e) => setWsUrlDraft(e.target.value)}
                onBlur={() => setWsUrl(wsUrlDraft.trim())}
                onKeyDown={(e) => e.key === 'Enter' && setWsUrl(wsUrlDraft.trim())}
              />
            </label>
          )}

          <label>
            Tema
            <select value={theme} onChange={(e) => setTheme(e.target.value as ChatWidgetTheme)}>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="auto">Automático</option>
            </select>
          </label>

          <label>
            Posición
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as ChatWidgetPosition)}
            >
              <option value="bottom-right">Abajo a la derecha</option>
              <option value="bottom-left">Abajo a la izquierda</option>
            </select>
          </label>

          <fieldset>
            <legend>Color principal</legend>
            <div className="demo__colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="demo__color"
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </fieldset>
        </section>
      </main>

      <ChatWidget
        key={`${kind}-${wsUrl}`}
        transport={transport}
        title="AGIChat"
        subtitle="Asistente virtual"
        welcomeMessage="¡Hola! 👋 Soy el asistente de **AGIChat**. ¿En qué puedo ayudarte hoy?"
        suggestions={SUGGESTIONS}
        theme={theme}
        position={position}
        primaryColor={color}
        defaultOpen
      />
    </div>
  );
}
