/**
 * Generador de respuestas simuladas del agente (fase 1).
 *
 * Lo comparten `MockTransport` (en el navegador) y el servidor WebSocket mock (Node),
 * por eso NO debe tener imports de valores: Node lo ejecuta directamente con type stripping.
 */

export interface MockLink {
  url: string;
  label: string;
}

/** `links`: sitios de referencia que el agente simulado abre en una pestaña (evento `open_url`). */
export type MockReply = { content: string; links?: MockLink[] } | { error: string };

export type MockResponder = (userMessage: string) => MockReply;

const HELP = `Soy el **agente de demostración** de AGIChat 🤖. Prueba escribiendo:

- \`markdown\` → ejemplo con todo el formato soportado
- \`tabla\` → una tabla
- \`código\` → un bloque de código
- \`lista\` → listas y tareas
- \`recomiéndame una película\` → recomendación con póster (datos de ejemplo de TMDB)
- \`compárala con el libro\` → comparación película vs. libro
- \`abre IMDb\` → abre la ficha de IMDb en una pestaña nueva
- \`error\` → simula un fallo del agente

> Para respuestas reales usa el backend **Agente real** (\`npm run agent-server\`).`;

const TABLE = `Estos son los planes de AGIChat:

| Plan | Mensajes / mes | Precio |
| :--- | ---: | :---: |
| Starter | 1,000 | $0 |
| Pro | 50,000 | $49 |
| Enterprise | Ilimitados | A convenir |`;

const CODE = `Así se integra el widget en tu aplicación:

\`\`\`ts
import { ChatWidget, MockTransport } from 'agichat-widget';
import 'agichat-widget/style.css';

const transport = new MockTransport();

export function App() {
  return <ChatWidget transport={transport} title="Soporte" />;
}
\`\`\`

También puedes usar código en línea como \`mountChatWidget()\`.`;

const LIST = `Pasos para lanzar tu asistente:

1. Crea una cuenta
2. Configura tu agente
3. Pega el snippet en tu sitio

Checklist de hoy:

- [x] Diseñar el widget
- [x] Conectar el mock
- [ ] Conectar el agente real (fase 2)`;

const MARKDOWN = `# Encabezado
## Subtítulo

Texto en **negrita**, *cursiva*, ~~tachado~~ y un [enlace](https://github.com).

> Una cita para inspirar a los inversionistas.

- Elemento de lista
- Otro elemento

\`\`\`json
{ "status": "ok" }
\`\`\`

---

| Col A | Col B |
| --- | --- |
| 1 | 2 |`;

const UNIVERSE = `Según *La guía del autoestopista galáctico* de Douglas Adams, la respuesta a la pregunta última sobre la vida, el universo y todo lo demás es **42**.`;

const DUNE_POSTER = 'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg';

const RECOMMENDATION = `¡Tengo una para ti! 🎬

![Póster de Dune](${DUNE_POSTER})

**Dune** (2021) · ⭐ 7.8/10 · Ciencia ficción, aventura

Paul Atreides viaja a Arrakis, el planeta más peligroso del universo, para asegurar el futuro de su familia. Visualmente impresionante y con una banda sonora enorme.

📚 **Dune** está basada en la novela de Frank Herbert (1965). ¿Quieres que la compare con el libro y te diga si vale la pena verla?`;

const COMPARISON = `**Dune (2021) vs. *Dune* de Frank Herbert (1965)**

| | Película | Libro |
| :--- | :---: | :---: |
| Calificación | ⭐ 7.8 (TMDB) | ⭐ 4.5 (Google Books) |
| Duración | 155 min | ~700 páginas |
| Historia | Primera mitad del libro | Completa |

**Veredicto: vale la pena verla.** Es fiel al tono y al mundo del libro, y su apartado visual es sobresaliente. Eso sí, la novela profundiza mucho más en la política y los pensamientos de los personajes: si te gusta, léela después.`;

const IMDB = `Listo, abrí la ficha de **Dune** en IMDb en una pestaña nueva. 🍿`;

const RULES: Array<{ pattern: RegExp; reply: MockReply }> = [
  { pattern: /\berror\b/i, reply: { error: 'El agente simulado falló a propósito. 💥' } },
  { pattern: /\bmarkdown\b/i, reply: { content: MARKDOWN } },
  {
    pattern: /\bimdb\b/i,
    reply: {
      content: IMDB,
      links: [{ url: 'https://www.imdb.com/title/tt1160419/', label: 'IMDb: Dune' }],
    },
  },
  { pattern: /\b(libro|novela|compara)/i, reply: { content: COMPARISON } },
  { pattern: /recomi[eé]nd|pel[ií]cula/i, reply: { content: RECOMMENDATION } },
  { pattern: /\btabla|table\b/i, reply: { content: TABLE } },
  { pattern: /c[oó]digo|\bcode\b/i, reply: { content: CODE } },
  { pattern: /\blista|list\b/i, reply: { content: LIST } },
  { pattern: /\b(ayuda|help)\b/i, reply: { content: HELP } },
  // Conversación de ejemplo del wireframe.
  { pattern: /universo|\b42\b|sentido de la vida/i, reply: { content: UNIVERSE } },
  {
    pattern: /\b(hola|buenas|buenos|hey|hi|hello)\b/i,
    reply: { content: `¡Hola! 👋 ¿En qué puedo ayudarte hoy?\n\n${HELP}` },
  },
];

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

/** Responder por defecto: reglas por palabras clave y eco en Markdown como respaldo. */
export const defaultResponder: MockResponder = (userMessage) => {
  const text = userMessage.trim();
  const rule = RULES.find(({ pattern }) => pattern.test(text));
  if (rule) return rule.reply;
  return {
    content: `Recibí tu mensaje:\n\n${quote(text)}\n\nPor ahora soy un **agente simulado**; en la fase 2 me reemplazará un agente real. Escribe \`ayuda\` para ver qué puedo hacer.`,
  };
};

/** Divide un texto en fragmentos (palabra + espacios) para simular streaming. */
export function chunkText(text: string): string[] {
  return text.match(/\s*\S+\s*/g) ?? (text.length > 0 ? [text] : []);
}
