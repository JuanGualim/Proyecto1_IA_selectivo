import { cleanText, compactText, decodeBase64Blocks, foldText } from './textNormalization.ts';

/**
 * Guardia de entrada contra prompt injection directo (OWASP LLM01) e intentos de extraer el
 * system prompt (OWASP LLM07). Es una capa determinista que corre ANTES del modelo: bloquea
 * los ataques evidentes sin gastar tokens y marca los dudosos para reforzar el contexto.
 */

export type ThreatCategory =
  | 'instruction_override'
  | 'role_hijack'
  | 'prompt_extraction'
  | 'delimiter_injection'
  | 'encoded_payload';

export type RiskLevel = 'none' | 'medium' | 'high';

export interface InputVerdict {
  allowed: boolean;
  risk: RiskLevel;
  categories: ThreatCategory[];
  /** Texto limpio (sin caracteres invisibles) que se envía al modelo. */
  text: string;
  /** Respuesta para el usuario cuando se bloquea. */
  refusal?: string;
}

export const MAX_INPUT_LENGTH = 2000;

interface Rule {
  category: ThreatCategory;
  risk: Exclude<RiskLevel, 'none'>;
  /** Se evalúa sobre `foldText` (minúsculas, sin tildes, sin leetspeak). */
  pattern: RegExp;
}

const RULES: Rule[] = [
  // --- Sobrescritura de instrucciones (ES / EN) ---
  {
    category: 'instruction_override',
    risk: 'high',
    pattern:
      /\b(ignora|olvida|omite|descarta|desobedece|anula)\b.{0,30}\b(instrucciones|reglas|indicaciones|directrices|restricciones|prompt)\b.{0,20}\b(anteriores|previas|de arriba|del sistema|iniciales|originales)\b/,
  },
  {
    category: 'instruction_override',
    risk: 'high',
    pattern:
      /\b(ignora|olvida|omite|descarta|desobedece|anula)\s+(todas\s+)?(tus|sus)\s+(instrucciones|reglas|indicaciones|directrices|restricciones)\b/,
  },
  {
    category: 'instruction_override',
    risk: 'high',
    pattern:
      /\b(ignore|forget|disregard|override|bypass)\b.{0,25}\b(previous|prior|above|earlier|all|your|system)\b.{0,20}\b(instructions|rules|prompt|guidelines|directives)\b/,
  },
  {
    category: 'instruction_override',
    risk: 'high',
    pattern: /\b(nuevas instrucciones|new instructions|instrucciones actualizadas)\s*:/,
  },
  // --- Secuestro de rol / jailbreak ---
  {
    category: 'role_hijack',
    risk: 'high',
    pattern:
      /\b(modo (desarrollador|dios|sin restricciones|sin filtros|dan)|developer mode|god mode|jailbreak|do anything now|\bdan\b mode)\b/,
  },
  {
    category: 'role_hijack',
    risk: 'medium',
    pattern:
      /\b(a partir de ahora|desde ahora|from now on)\b.{0,40}\b(eres|seras|actua|act as|you are|responde como)\b/,
  },
  {
    category: 'role_hijack',
    risk: 'medium',
    pattern:
      /\b(you are now|ahora eres|finge que eres|pretend (to be|you are)|actua como si no tuvieras)\b/,
  },
  // --- Extracción del system prompt (LLM07) ---
  {
    category: 'prompt_extraction',
    risk: 'high',
    pattern:
      /\b(system prompt|prompt (del|de) sistema|mensaje (del|de) sistema|instrucciones (del|de) sistema|prompt inicial|initial prompt|system message)\b/,
  },
  {
    category: 'prompt_extraction',
    risk: 'high',
    pattern:
      /\b(muestra|muestrame|revela|repite|imprime|escribe|copia|traduce|resume|dime|cuales son|lista|print|reveal|repeat|show|tell me|output|translate|summarize|what are)\b.{0,30}\b(tus|your)\b.{0,15}\b(instrucciones|reglas|indicaciones|directrices|configuracion|instructions|rules|guidelines|configuration)\b/,
  },
  {
    category: 'prompt_extraction',
    risk: 'high',
    pattern:
      /\b(repite|imprime|copia|print|repeat|output)\b.{0,30}\b(todo lo anterior|el texto (de arriba|anterior)|everything above|the text above|all of the above|lo que esta arriba)\b/,
  },
  {
    category: 'prompt_extraction',
    risk: 'high',
    pattern:
      /\b(instrucciones|reglas|indicaciones|prompt) (que )?te (dieron|dio|programaron|configuraron|escribieron)\b|\b(instructions|rules|prompt) (you were|you've been) given\b/,
  },
  {
    category: 'prompt_extraction',
    risk: 'high',
    pattern: /\b(canary|token (de control|secreto|interno)|palabra secreta|secret (token|word))\b/,
  },
  // --- Delimitadores falsos de rol ---
  {
    category: 'delimiter_injection',
    risk: 'high',
    pattern:
      /(<\|?(im_start|im_end|system|endoftext)\|?>|\[\/?(inst|system)\]|<\/?(system|instrucciones|developer)>|^\s*#{1,3}\s*(system|sistema)\b|^\s*(system|sistema|developer)\s*:)/m,
  },
];

/** Frases compactas (sin espacios) para detectar letras separadas u ofuscadas. */
const COMPACT_PHRASES = [
  'ignoratusinstrucciones',
  'ignoralasinstruccionesanteriores',
  'ignoreallpreviousinstructions',
  'ignorepreviousinstructions',
  'systemprompt',
  'promptdelsistema',
  'revelatusinstrucciones',
  'olvidatusreglas',
];

const REFUSALS: Record<ThreatCategory, string> = {
  prompt_extraction:
    'No puedo compartir mi configuración interna ni mis instrucciones. 🎬 Pero con gusto te ' +
    'recomiendo una película o la comparo con su libro. ¿Qué género te gusta?',
  instruction_override:
    'No puedo cambiar mis instrucciones ni mi forma de trabajar. Estoy aquí para ayudarte con ' +
    'películas y libros: ¿quieres una recomendación?',
  role_hijack: 'Prefiero seguir siendo tu asistente de cine 🍿. ¿Te recomiendo algo para ver hoy?',
  delimiter_injection:
    'Tu mensaje contiene un formato que no puedo procesar. Escríbeme con tus propias palabras ' +
    'qué película o libro te interesa.',
  encoded_payload:
    'No puedo procesar instrucciones codificadas. Cuéntame directamente qué película buscas.',
};

const PRIORITY: ThreatCategory[] = [
  'prompt_extraction',
  'instruction_override',
  'delimiter_injection',
  'encoded_payload',
  'role_hijack',
];

function detect(text: string): Array<{ category: ThreatCategory; risk: 'medium' | 'high' }> {
  const folded = foldText(text);
  const compact = compactText(text);
  const findings = RULES.filter((rule) => rule.pattern.test(folded)).map(({ category, risk }) => ({
    category,
    risk,
  }));
  if (COMPACT_PHRASES.some((phrase) => compact.includes(phrase))) {
    findings.push({
      category: compact.includes('prompt') ? 'prompt_extraction' : 'instruction_override',
      risk: 'high',
    });
  }
  return findings;
}

/** Analiza el mensaje del usuario y decide si se envía al agente. */
export function inspectUserInput(raw: string): InputVerdict {
  const text = cleanText(raw).slice(0, MAX_INPUT_LENGTH);
  const findings = detect(text);

  // Instrucciones escondidas en Base64 cuentan como ataque codificado.
  for (const decoded of decodeBase64Blocks(text)) {
    if (detect(decoded).length > 0) findings.push({ category: 'encoded_payload', risk: 'high' });
  }

  const categories = [...new Set(findings.map((finding) => finding.category))];
  const risk: RiskLevel = findings.some((finding) => finding.risk === 'high')
    ? 'high'
    : findings.length > 0
      ? 'medium'
      : 'none';

  if (risk !== 'high') return { allowed: true, risk, categories, text };

  const main = PRIORITY.find((category) => categories.includes(category)) ?? 'instruction_override';
  return { allowed: false, risk, categories, text, refusal: REFUSALS[main] };
}
