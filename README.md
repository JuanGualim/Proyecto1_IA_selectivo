# AGIChat Widget SDK

[![CI](https://github.com/JuanGualim/Proyecto1_IA_selectivo/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanGualim/Proyecto1_IA_selectivo/actions/workflows/ci.yml)
[![CD](https://github.com/JuanGualim/Proyecto1_IA_selectivo/actions/workflows/cd.yml/badge.svg)](https://github.com/JuanGualim/Proyecto1_IA_selectivo/actions/workflows/cd.yml)

SDK de un **widget de chat agéntico** que permite a los clientes de AGIChat añadir una interfaz
de agente de IA a sus sitios en minutos. Proyecto #1 del curso CC3116.

- 💬 Botón flotante + ventana de chat, responsive (pantalla completa en móvil).
- ✍️ Respuestas del agente en **Markdown** (tablas, código con botón copiar, listas de tareas,
  enlaces, citas…) renderizadas de forma segura.
- ⚡ **Streaming** de respuestas fragmento a fragmento, indicador de "escribiendo" y estados de
  conexión.
- 🔌 Arquitectura de **puertos y adaptadores**: hoy se conecta a un mock (en el navegador o por
  WebSocket); en la fase 2 se cambia a un agente real sin tocar la UI.
- 🎨 Personalizable: color principal, tema claro/oscuro/automático, posición, textos y
  sugerencias.
- ✅ ~99 % de cobertura de tests, lint y CI/CD con GitHub Actions.

📐 Arquitectura y estructura de carpetas: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
🤝 Cómo contribuir (GitHub Flow): [`CONTRIBUTING.md`](CONTRIBUTING.md)
🤖 Guía para agentes de código: [`AGENTS.md`](AGENTS.md)

## Inicio rápido

Requisitos: **Node.js ≥ 22.18** (se recomienda la versión de `.nvmrc`: 24).

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>: es una página de ejemplo que simula el sitio de un cliente con el
widget integrado. Prueba escribir `ayuda`, `tabla`, `código`, `markdown` o `error`.

### Probar con el servidor WebSocket simulado

```bash
npm run mock-server
```

Luego, en la demo, selecciona **Backend → WebSocket** (o abre
<http://localhost:5173/?transport=websocket>). El widget se conecta a `ws://127.0.0.1:8787`,
exactamente como se conectará al agente real en la fase 2. Si apagas el servidor, el widget
muestra el estado y se reconecta solo al volver a encenderlo.

## Scripts

| Comando                 | Descripción                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo de la demo                                    |
| `npm run mock-server`   | Servidor WebSocket que simula al agente (puerto `8787`, var. `PORT`) |
| `npm run lint`          | ESLint (sin advertencias permitidas)                                 |
| `npm run format`        | Formatea con Prettier (`format:check` solo verifica)                 |
| `npm run typecheck`     | Verificación de tipos con TypeScript                                 |
| `npm test`              | Ejecuta los tests                                                    |
| `npm run test:coverage` | Tests + reporte de cobertura (falla si es < 80 %)                    |
| `npm run build`         | Build del SDK (`dist/lib`, `dist/embed`) y de la demo (`dist/demo`)  |
| `npm run ci`            | Todo lo anterior, igual que el pipeline de CI                        |

## Uso del SDK

### 1. En una aplicación React

```tsx
import { ChatWidget, MockTransport, WebSocketTransport } from 'agichat-widget';
import 'agichat-widget/style.css';

// Fase 1: agente simulado
const transport = new MockTransport();
// Fase 2: agente real (mismo protocolo)
// const transport = new WebSocketTransport({ url: 'wss://api.agichat.dev/agent' });

export function App() {
  return (
    <ChatWidget
      transport={transport}
      title="Soporte"
      subtitle="Respondemos al instante"
      welcomeMessage="¡Hola! 👋 ¿En qué te ayudo?"
      suggestions={['Ver planes', 'Hablar con ventas']}
      primaryColor="#0ea5e9"
      theme="auto"
    />
  );
}
```

> Crea el transporte **fuera** del componente (o con `useMemo`) para no reconectar en cada render.

### 2. En cualquier sitio (sin React)

```html
<link rel="stylesheet" href="agichat-widget.css" />
<script src="agichat-widget.iife.js"></script>
<script>
  AGIChat.mountChatWidget({
    title: 'Soporte',
    transport: { type: 'websocket', url: 'wss://api.agichat.dev/agent' },
  });
</script>
```

`mountChatWidget(options, target?)` devuelve `{ unmount, transport }`. Si no se indica `target`,
crea su propio contenedor en `<body>`.

### Propiedades de `ChatWidget`

| Prop              | Tipo                              | Por defecto             |
| ----------------- | --------------------------------- | ----------------------- |
| `transport`       | `ChatTransport` (obligatorio)     | —                       |
| `title`           | `string`                          | `'AGIChat'`             |
| `subtitle`        | `string`                          | `'Asistente virtual'`   |
| `welcomeMessage`  | `string` (Markdown)               | saludo genérico         |
| `placeholder`     | `string`                          | `'Escribe un mensaje…'` |
| `suggestions`     | `string[]`                        | `[]`                    |
| `position`        | `'bottom-right' \| 'bottom-left'` | `'bottom-right'`        |
| `theme`           | `'light' \| 'dark' \| 'auto'`     | `'light'`               |
| `primaryColor`    | color CSS                         | `#6d4aff`               |
| `mode`            | `'floating' \| 'inline'`          | `'floating'`            |
| `defaultOpen`     | `boolean`                         | `false`                 |
| `initialMessages` | `ChatMessage[]`                   | `[]`                    |
| `onOpenChange`    | `(open: boolean) => void`         | —                       |

### Conectar un agente real (fase 2)

El backend solo necesita hablar el protocolo JSON de
[`src/core/protocol.ts`](src/core/protocol.ts) sobre WebSocket:

```jsonc
// Widget → agente
{ "type": "user_message", "id": "msg_1", "content": "Hola" }
// Agente → widget (streaming)
{ "type": "message_start", "id": "msg_2", "replyTo": "msg_1" }
{ "type": "message_delta", "id": "msg_2", "delta": "¡Hola! **Bienvenido**" }
{ "type": "message_end", "id": "msg_2" }
// o, si algo falla
{ "type": "error", "id": "msg_1", "message": "Descripción del error" }
```

Si el agente usa otro medio (SSE, HTTP streaming, SDK propietario), basta con crear un nuevo
adaptador que implemente `ChatTransport` (ver `docs/ARQUITECTURA.md`).

## Sobre el wireframe

La interfaz sigue el patrón del wireframe entregado por Maxine: botón flotante en la esquina,
ventana con encabezado (avatar, nombre, estado de conexión y acciones), lista de mensajes con
burbujas diferenciadas para usuario y agente, sugerencias rápidas y campo de texto con botón de
envío. Paleta y estilos propios (violeta/azul con degradado), según la libertad otorgada.

## Tecnologías

React 19 · TypeScript · Vite · Vitest + Testing Library · ESLint + Prettier ·
react-markdown + remark-gfm · ws (servidor mock) · GitHub Actions
