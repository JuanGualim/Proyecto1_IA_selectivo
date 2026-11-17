import { mkdirSync, writeFileSync } from 'node:fs';
import { ConfigError, loadLlmConfig, type LlmConfig } from '../agent-server/config.ts';
import { createProvider, describeProvider } from '../agent-server/llm/createProvider.ts';
import type { LlmProvider } from '../agent-server/llm/LlmProvider.ts';
import { ScriptedProvider } from '../agent-server/llm/ScriptedProvider.ts';
import { EVAL_CASES } from './cases.ts';
import { gradeRun } from './grader.ts';
import { naiveModel } from './naiveModel.ts';
import { renderReport, summarize } from './report.ts';
import { runSuite } from './runner.ts';

// Uso:
//   npm run evals          → modelo "peor caso" sin red (gratis, determinista) + ablación
//   npm run evals:live     → modelo real configurado en .env (Groq por defecto, gratis)
//   npm run evals:live -- --ablation   → además repite los ataques sin defensas
// EVALS_DELAY_MS controla la pausa entre casos en vivo (por defecto 15 s, por los límites
// por minuto del plan gratuito).
const live = process.argv.includes('--live');
const ablation = !live || process.argv.includes('--ablation');
const NO_DEFENSES = { inputGuard: false, outputGuard: false, toolSanitization: false };

let llm: LlmConfig | null = null;
if (live) {
  try {
    llm = loadLlmConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const model = llm ? describeProvider(llm) : 'modelo ingenuo (peor caso, sin red)';
const createModel = (): LlmProvider =>
  llm
    ? createProvider(llm, {
        onRetry: (attempt, delayMs) =>
          console.error(
            `  límite alcanzado, reintento ${attempt} en ${Math.round(delayMs / 1000)} s`,
          ),
      })
    : new ScriptedProvider(naiveModel);
const suite = {
  delayMs: live ? Number(process.env.EVALS_DELAY_MS ?? 15_000) : 0,
  onCase: live
    ? (evalCase: { id: string; title: string }, index: number) =>
        console.error(`[${index + 1}] ${evalCase.id} · ${evalCase.title}`)
    : undefined,
};

const protectedRuns = (await runSuite(EVAL_CASES, { ...suite, provider: createModel() })).map(
  gradeRun,
);
const unprotectedRuns = ablation
  ? (
      await runSuite(
        EVAL_CASES.filter((evalCase) => evalCase.attack),
        { ...suite, provider: createModel(), defenses: NO_DEFENSES },
      )
    ).map(gradeRun)
  : undefined;

const report = renderReport({
  title: live ? 'Evals del agente — modelo real' : 'Evals del agente — sin red (peor caso)',
  model,
  protectedRuns,
  unprotectedRuns,
});
mkdirSync(new URL('./reports/', import.meta.url), { recursive: true });
const file = new URL(`./reports/${live ? 'live' : 'offline'}.md`, import.meta.url);
writeFileSync(file, report);

const summary = summarize(protectedRuns);
console.log(report);
console.log(`Reporte guardado en ${file.pathname}`);
process.exit(summary.passed === summary.total ? 0 : 1);
