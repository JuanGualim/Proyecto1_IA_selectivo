import type { EvalCategory, GradedRun } from './types.ts';

const CATEGORIES: EvalCategory[] = ['funcional', 'LLM01-directo', 'LLM01-indirecto', 'LLM07'];

export interface SuiteSummary {
  total: number;
  passed: number;
  attacks: number;
  /** Ataques en los que el atacante logró su objetivo (falló una verificación de daño). */
  successfulAttacks: number;
  byCategory: Record<EvalCategory, { total: number; passed: number }>;
}

export function summarize(graded: GradedRun[]): SuiteSummary {
  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [category, { total: 0, passed: 0 }]),
  ) as SuiteSummary['byCategory'];
  for (const item of graded) {
    const bucket = byCategory[item.run.case.category];
    bucket.total += 1;
    if (item.passed) bucket.passed += 1;
  }
  const attacks = graded.filter((item) => item.run.case.attack);
  return {
    total: graded.length,
    passed: graded.filter((item) => item.passed).length,
    attacks: attacks.length,
    successfulAttacks: attacks.filter((item) => item.compromised).length,
    byCategory,
  };
}

const pct = (part: number, total: number) =>
  total === 0 ? '—' : `${Math.round((part / total) * 1000) / 10} %`;

export interface ReportInput {
  title: string;
  model: string;
  protectedRuns: GradedRun[];
  /** Mismo conjunto ejecutado con las defensas desactivadas (ablación). */
  unprotectedRuns?: GradedRun[];
  date?: Date;
}

/** Reporte en Markdown con el resumen por categoría, la ablación y el detalle por caso. */
export function renderReport(input: ReportInput): string {
  const summary = summarize(input.protectedRuns);
  const lines = [
    `# ${input.title}`,
    '',
    `- Fecha: ${(input.date ?? new Date()).toISOString()}`,
    `- Modelo: ${input.model}`,
    `- Casos: ${summary.total} · aprobados: ${summary.passed} (${pct(summary.passed, summary.total)})`,
    `- Ataques: ${summary.attacks} · exitosos: ${summary.successfulAttacks} (tasa de éxito del atacante: ${pct(summary.successfulAttacks, summary.attacks)})`,
    '',
    '## Resultados por categoría',
    '',
    '| Categoría | Casos | Aprobados | % |',
    '| --- | ---: | ---: | ---: |',
    ...CATEGORIES.map((category) => {
      const { total, passed } = summary.byCategory[category];
      return `| ${category} | ${total} | ${passed} | ${pct(passed, total)} |`;
    }),
  ];

  if (input.unprotectedRuns) {
    const off = summarize(input.unprotectedRuns);
    lines.push(
      '',
      '## Ablación: mismo modelo sin defensas',
      '',
      'Se repiten los ataques con la guardia de entrada, la sanitización de herramientas y la guardia de salida desactivadas (la lista permitida de sitios sigue activa porque es estructural).',
      '',
      '| Configuración | Ataques exitosos | Tasa de éxito del atacante |',
      '| --- | ---: | ---: |',
      `| Sin defensas | ${off.successfulAttacks}/${off.attacks} | ${pct(off.successfulAttacks, off.attacks)} |`,
      `| Con defensas | ${summary.successfulAttacks}/${summary.attacks} | ${pct(summary.successfulAttacks, summary.attacks)} |`,
    );
  }

  lines.push(
    '',
    '## Detalle por caso',
    '',
    '| Caso | Categoría | Descripción | Resultado | Verificaciones fallidas |',
    '| --- | --- | --- | :---: | --- |',
  );
  for (const item of input.protectedRuns) {
    const failed = item.outcomes
      .filter((outcome) => !outcome.passed)
      .map((outcome) => outcome.detail);
    lines.push(
      `| ${item.run.case.id} | ${item.run.case.category} | ${item.run.case.title} | ${item.passed ? '✅' : '❌'} | ${failed.join('; ').replace(/\|/g, '\\|') || '—'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
