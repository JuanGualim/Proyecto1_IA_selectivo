import { randomBytes } from 'node:crypto';
import { foldText } from './textNormalization.ts';

/**
 * Guardia de salida contra la filtración del system prompt (OWASP LLM07) y la exfiltración
 * de datos por Markdown (imágenes/enlaces a dominios no confiables).
 *
 * Se aplica a la respuesta final ANTES de enviarla al usuario:
 *  - Token canario: un valor aleatorio incluido en el system prompt. Si aparece en la salida,
 *    el modelo está filtrando sus instrucciones y la respuesta se reemplaza.
 *  - Coincidencia de fragmentos: si la salida contiene varios fragmentos literales de
 *    8 palabras del system prompt, también se considera una filtración (aunque no esté el canario).
 *  - Imágenes y enlaces: solo se permiten dominios conocidos (TMDB, IMDb, Google Books).
 */

export const LEAK_RESPONSE =
  'No puedo compartir detalles de mi configuración interna. 🎬 ¿Te ayudo a encontrar una ' +
  'película o a compararla con su libro?';

const SHINGLE_SIZE = 8;
const LEAK_THRESHOLD = 2;

const IMAGE_HOSTS = new Set(['image.tmdb.org', 'books.google.com', 'books.googleusercontent.com']);
const LINK_HOSTS = new Set([
  'www.themoviedb.org',
  'themoviedb.org',
  'www.imdb.com',
  'imdb.com',
  'books.google.com',
  'www.google.com',
]);

export interface OutputGuardOptions {
  canary: string;
  /** Prompts del sistema de todos los agentes (supervisor y especialistas). */
  systemPrompts: string[];
}

export interface OutputVerdict {
  text: string;
  leaked: boolean;
  reasons: string[];
}

/** Genera un token canario aleatorio por proceso. */
export function createCanary(): string {
  return `AGC-${randomBytes(8).toString('hex')}`;
}

function shingles(text: string): Set<string> {
  const words = foldText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const result = new Set<string>();
  for (let index = 0; index + SHINGLE_SIZE <= words.length; index += 1) {
    result.add(words.slice(index, index + SHINGLE_SIZE).join(' '));
  }
  return result;
}

function countSharedShingles(output: string, prompt: string): number {
  const promptShingles = shingles(prompt);
  let shared = 0;
  for (const shingle of shingles(output)) {
    if (promptShingles.has(shingle)) shared += 1;
  }
  return shared;
}

function isAllowedUrl(raw: string, hosts: Set<string>): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && hosts.has(url.hostname);
  } catch {
    return false;
  }
}

/** Quita imágenes y enlaces Markdown hacia dominios no permitidos (evita exfiltración). */
export function sanitizeMarkdownUrls(text: string): { text: string; removed: number } {
  let removed = 0;
  const withImages = text.replace(
    /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (match, alt: string, url: string) => {
      if (isAllowedUrl(url, IMAGE_HOSTS)) return match;
      removed += 1;
      return alt ? `(${alt})` : '';
    },
  );
  const withLinks = withImages.replace(
    /(?<!!)\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (match, label: string, url: string) => {
      if (isAllowedUrl(url, LINK_HOSTS)) return match;
      removed += 1;
      return label;
    },
  );
  return { text: withLinks, removed };
}

/** Revisa la respuesta del agente antes de mostrarla al usuario. */
export function inspectOutput(text: string, options: OutputGuardOptions): OutputVerdict {
  const reasons: string[] = [];
  const folded = foldText(text).replace(/[^a-z0-9]/g, '');
  const canary = foldText(options.canary).replace(/[^a-z0-9]/g, '');

  if (canary && folded.includes(canary)) reasons.push('canary');
  if (options.systemPrompts.some((prompt) => countSharedShingles(text, prompt) >= LEAK_THRESHOLD)) {
    reasons.push('system_prompt_overlap');
  }
  if (/<\/?\s*datos_externos/i.test(text)) reasons.push('internal_delimiters');

  if (reasons.length > 0) return { text: LEAK_RESPONSE, leaked: true, reasons };

  const { text: sanitized, removed } = sanitizeMarkdownUrls(text);
  if (removed > 0) reasons.push('untrusted_urls_removed');
  return { text: sanitized, leaked: false, reasons };
}
