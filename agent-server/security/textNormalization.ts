/**
 * Normalización de texto para detectar ataques ofuscados (OWASP LLM01).
 * Los atacantes esconden instrucciones con caracteres invisibles, homoglifos, "leetspeak"
 * o letras separadas ("i g n o r a"). Se compara siempre contra versiones normalizadas.
 */

/** Caracteres invisibles o de control de dirección (zero-width, bidi, BOM). */
const INVISIBLE = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Quita caracteres invisibles y de control, aplica NFKC y colapsa espacios. */
export function cleanText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/[^\P{Cc}\n\t]/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Minúsculas, sin tildes y con "leetspeak" traducido. Para comparar con patrones. */
export function foldText(text: string): string {
  return cleanText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => LEET[char] ?? char);
}

/** Versión sin espacios ni signos: detecta "i-g-n-o-r-a  t u s  r e g l a s". */
export function compactText(text: string): string {
  return foldText(text).replace(/[^a-z]/g, '');
}

/** Decodifica bloques Base64 largos que puedan esconder instrucciones. */
export function decodeBase64Blocks(text: string): string[] {
  const blocks = text.match(/[A-Za-z0-9+/]{24,}={0,2}/g) ?? [];
  return blocks.flatMap((block) => {
    try {
      const decoded = Buffer.from(block, 'base64').toString('utf8');
      // Solo se considera si el resultado parece texto legible.
      return /^[\p{L}\p{N}\p{P}\p{Zs}\n]+$/u.test(decoded) ? [decoded] : [];
    } catch {
      return [];
    }
  });
}
