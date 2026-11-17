import { mkdirSync, writeFileSync } from 'node:fs';
import {
  AnthropicProvider,
  DEFAULT_ANTHROPIC_MODEL,
} from '../agent-server/llm/AnthropicProvider.ts';
import type { LlmProvider } from '../agent-server/llm/LlmProvider.ts';
import { ScriptedProvider } from '../agent-server/llm/ScriptedProvider.ts';
import { EVAL_CASES } from './cases.ts';
import { gradeRun } from './grader.ts';
import { naiveModel } from './naiveModel.ts';
import { renderReport, summarize } from './report.ts';
import { runSuite } from './runner.ts';

// Uso:
//   npm run evals          → modelo "peor caso" sin red (gratis, determinista) + ablación
//   npm run evals:live     → modelo real de Claude (requiere ANTHROPIC_API_KEY; tiene costo)
//   npm run evals:live -- --ablation   → además repite los ataques sin defensas
const live = process.argv.includes('--live');
const ablation = !live || process.argv.includes('--ablation');
const NO_DEFENSES = { inputGuard: false, outputGuard: false, toolSanitization: false };

const model = live
  ? process.env.LLM_MODEL || DEFAULT_ANTHROPIC_MODEL
  : 'modelo ingenuo (peor caso, sin red)';
const createProvider = (): LlmProvider =>
  live
    ? new AnthropicProvider({ model, apiKey: process.env.ANTHROPIC_API_KEY })
    : new ScriptedProvider(naiveModel);

const protectedRuns = (await runSuite(EVAL_CASES, { provider: createProvider() })).map(gradeRun);
const unprotectedRuns = ablation
  ? (
      await runSuite(
        EVAL_CASES.filter((evalCase) => evalCase.attack),
        { provider: createProvider(), defenses: NO_DEFENSES },
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
