# AGENTS.md

Instrucciones para herramientas de codeo agéntico (Claude Code, Codex, Cursor, Copilot, etc.)
que trabajen en este repositorio. Los humanos también deberían leerlo.

## Proyecto

SDK de un widget de chat agéntico (React 19 + TypeScript + Vite) para la startup AGIChat.
Fase 1: la UI se conecta a un backend **simulado** (mock). Fase 2: se conectará a un agente real
**sin cambiar la UI**, solo cambiando el adaptador de transporte.

Lee [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) antes de hacer cambios estructurales.

## Comandos

```bash
npm install            # instalar dependencias (Node >= 22.18, ver .nvmrc)
npm run dev            # demo en http://localhost:5173
npm run mock-server    # servidor WebSocket simulado en ws://127.0.0.1:8787
npm run lint           # ESLint, 0 advertencias permitidas
npm run format         # Prettier (escribe); format:check solo verifica
npm run typecheck      # tsc --noEmit
npm test               # Vitest
npm run test:coverage  # Vitest + cobertura (umbral 80 % obligatorio)
npm run ci             # TODO lo que corre el pipeline de CI: úsalo antes de terminar una tarea
```

Para ejecutar un solo archivo de test: `npx vitest run src/core/chatReducer.test.ts`.

## Arquitectura (hexagonal) y reglas de dependencias

```text
src/core        → dominio puro (tipos, protocolo, reducer). SIN React, SIN DOM, SIN red.
src/transports  → puerto ChatTransport + adaptadores (MockTransport, WebSocketTransport).
src/hooks       → useChat: une transporte + reducer.
src/components  → UI React; solo recibe props / usa hooks.
src/sdk, src/index.ts, src/embed.ts → API pública.
mock-server/    → servidor WebSocket simulado (Node), reutiliza core/protocol y mock/responder.
demo/           → app de ejemplo; NO es parte del SDK.
```

Reglas estrictas:

- Las dependencias van de afuera hacia adentro: `components → hooks → transports → core`.
  `core` nunca importa de otras capas.
- Los componentes **nunca** instancian ni importan un adaptador concreto; reciben un
  `ChatTransport`.
- Toda la lógica de estado del chat va en `chatReducer` (función pura) y se prueba ahí.
- `src/core/protocol.ts` y `src/transports/mock/responder.ts` **no pueden tener imports de
  valores** (solo `import type`): el servidor mock los ejecuta con Node directamente.
- Cualquier cambio al protocolo requiere actualizar: `protocol.ts` (+ `parseServerEvent`),
  `chatReducer.ts`, `mock-server/`, sus tests y la tabla del protocolo en `docs/ARQUITECTURA.md`.
- Lo exportado en `src/index.ts` es API pública: no lo rompas sin avisarlo en el PR.

## Recetas frecuentes

**Agregar un adaptador de transporte (p. ej. para el agente real):**

1. `src/transports/MiTransport.ts`: `export class MiTransport extends BaseTransport`. Implementa
   `connect`, `disconnect`, `send`; usa `this.emit(evento)` y `this.setStatus(estado)`.
   `send` debe lanzar `TransportNotConnectedError` si no puede enviar.
2. `src/transports/MiTransport.test.ts` con dobles (mira `WebSocketTransport.test.ts`).
3. Registrar en `createTransport.ts` y exportar desde `src/transports/index.ts`.

**Agregar un componente:**

1. `src/components/Nombre/Nombre.tsx` + `Nombre.test.tsx` en la misma carpeta.
2. Estilos en `src/styles/agichat.css` con clases BEM prefijadas `agichat-nombre__elemento`.
3. Colores solo mediante variables `--agichat-*` (soportan tema claro/oscuro).

**Agregar un tipo de evento del agente:** protocolo → reducer (+ tests) → UI (+ tests) → docs.

## Convenciones de código

- TypeScript estricto (`strict`, `noUncheckedIndexedAccess`). Prohibido `any`; usa `unknown` y
  valida.
- `import type` para importaciones solo de tipos (lo exige ESLint).
- Componentes: funciones con nombre (`export function ChatInput`), props tipadas con una
  interfaz `NombreProps`, sin `default export`.
- Un archivo solo exporta componentes **o** utilidades (regla `react-refresh`); las utilidades
  puras van en `src/core`.
- Nombres de código en inglés; **textos visibles, comentarios y documentación en español**.
- Accesibilidad: todo botón con icono lleva `aria-label`; usa roles (`dialog`, `log`, `alert`,
  `status`).
- El Markdown del agente se renderiza **solo** con `MarkdownContent`; nunca uses
  `dangerouslySetInnerHTML` ni `rehype-raw`.
- Formato: Prettier (comillas simples, `printWidth` 100, comas finales).

## Tests

- Vitest + Testing Library (entorno `jsdom`; los tests de `mock-server/` usan
  `// @vitest-environment node`).
- Archivo `*.test.ts(x)` junto al código que prueba.
- Prueba comportamiento visible (roles, textos, labels), no detalles de implementación.
- Para la UI usa `FakeTransport` (`src/test/FakeTransport.ts`) y emite eventos con
  `transport.reply(id, texto)` / `serverEmit(evento)`.
- Timers: `vi.useFakeTimers()` y restaura en `afterEach`.
- La cobertura mínima es 80 % en líneas, ramas, funciones y sentencias; el CI falla si baja.
  Mantén la actual (~99 %) agregando tests con cada cambio.

## Flujo de trabajo (GitHub Flow)

- Nunca hagas commit ni push directo a `main`. Crea `feature/...`, `fix/...`, etc.
- Commits con Conventional Commits en español: `feat: ...`, `fix: ...`, `test: ...`.
- Antes de dar una tarea por terminada: `npm run ci` debe pasar completo.
- Abre un PR hacia `main` usando la plantilla; requiere aprobación de otro integrante.

## No hacer

- No agregues dependencias pesadas sin justificarlo en el PR (el widget se incrusta en sitios de
  terceros; el tamaño del bundle importa).
- No edites `dist/`, `coverage/` ni `package-lock.json` a mano.
- No desactives reglas de ESLint ni bajes el umbral de cobertura para que el CI pase.
- No guardes secretos ni URLs privadas de agentes en el código; se pasan por configuración.
