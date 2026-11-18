import { useMemo, useState } from 'react';
import {
  ChatWidget,
  MockTransport,
  TMDB_ATTRIBUTION,
  WebSocketTransport,
  type ChatTransport,
  type ChatWidgetPosition,
  type ChatWidgetTheme,
} from '../src';

type TransportKind = 'mock' | 'websocket' | 'agent';
type Layout = 'panel' | 'floating';

const DEFAULT_WS_URL = 'ws://127.0.0.1:8787';
/** Servidor del agente real (`npm run agent-server`). */
const DEFAULT_AGENT_URL = 'ws://127.0.0.1:8788';
const TRANSPORT_KINDS: TransportKind[] = ['mock', 'websocket', 'agent'];
/** `undefined` = color por defecto del widget (respeta el tema oscuro). */
const COLORS: Array<string | undefined> = [undefined, '#0ea5e9', '#10b981', '#f43f5e', '#15161c'];
const SUGGESTIONS = [
  'Recomiéndame una película de ciencia ficción',
  '¿Dune vale la pena o mejor leo el libro?',
  'Abre IMDb de Interstellar',
];

function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Página de ejemplo que simula el sitio de un cliente usando el SDK.
 * Por defecto reproduce el wireframe: panel de 400×700 centrado sobre la página.
 */
export function DemoApp() {
  const [layout, setLayout] = useState<Layout>(
    readParam('layout') === 'floating' ? 'floating' : 'panel',
  );
  const initialKind = TRANSPORT_KINDS.find((item) => item === readParam('transport')) ?? 'mock';
  const [kind, setKind] = useState<TransportKind>(initialKind);
  const initialUrl = initialKind === 'agent' ? DEFAULT_AGENT_URL : DEFAULT_WS_URL;
  const [wsUrl, setWsUrl] = useState(initialUrl);
  const [wsUrlDraft, setWsUrlDraft] = useState(initialUrl);

  const changeKind = (next: TransportKind) => {
    const url = next === 'agent' ? DEFAULT_AGENT_URL : DEFAULT_WS_URL;
    setKind(next);
    setWsUrl(url);
    setWsUrlDraft(url);
  };
  const [theme, setTheme] = useState<ChatWidgetTheme>('light');
  const [position, setPosition] = useState<ChatWidgetPosition>('bottom-right');
  const [color, setColor] = useState<string | undefined>(undefined);

  // Cambiar de adaptador es lo único necesario para pasar del mock al agente real.
  const transport = useMemo<ChatTransport>(
    () => (kind === 'mock' ? new MockTransport() : new WebSocketTransport({ url: wsUrl })),
    [kind, wsUrl],
  );

  const widget = (
    <ChatWidget
      key={`${kind}-${wsUrl}-${layout}`}
      transport={transport}
      assistantName="Sofía"
      description="Te recomiendo películas, las comparo con su libro y abro IMDb o Google Books por ti"
      attribution={TMDB_ATTRIBUTION}
      mode={layout === 'panel' ? 'inline' : 'floating'}
      theme={theme}
      position={position}
      primaryColor={color}
      suggestions={SUGGESTIONS}
      defaultOpen
    />
  );

  return (
    <div className="demo">
      <details className="demo__settings">
        <summary>⚙️ Configurar demo</summary>

        <label>
          Diseño
          <select value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
            <option value="panel">Panel centrado (wireframe)</option>
            <option value="floating">Burbuja flotante</option>
          </select>
        </label>

        <label>
          Backend
          <select value={kind} onChange={(e) => changeKind(e.target.value as TransportKind)}>
            <option value="mock">Mock en el navegador</option>
            <option value="websocket">WebSocket mock (npm run mock-server)</option>
            <option value="agent">Agente real (npm run agent-server)</option>
          </select>
        </label>

        {kind !== 'mock' && (
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

        {layout === 'floating' && (
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
        )}

        <fieldset>
          <legend>Color principal</legend>
          <div className="demo__colors">
            {COLORS.map((c) => (
              <button
                key={c ?? 'default'}
                type="button"
                className="demo__color"
                style={{ background: c ?? 'linear-gradient(135deg, #4f46e5, #8b5cf6)' }}
                aria-label={c ? `Color ${c}` : 'Color por defecto'}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </fieldset>

        <p className="demo__hint">
          Prueba escribir <code>recomiéndame una película</code>,{' '}
          <code>compárala con el libro</code>, <code>abre IMDb</code> o <code>ayuda</code>. Si el
          navegador bloquea la pestaña, permite las ventanas emergentes para este sitio.
        </p>
      </details>

      {layout === 'panel' ? (
        <main className="demo__stage">
          <div className="demo__panel">{widget}</div>
        </main>
      ) : (
        <main className="demo__stage demo__stage--floating">
          <p className="demo__note">
            El widget está en la esquina inferior. Así se ve incrustado en el sitio de un cliente.
          </p>
          {widget}
        </main>
      )}
    </div>
  );
}
