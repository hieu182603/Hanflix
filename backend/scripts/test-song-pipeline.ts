// Runs isolated regression tests. Does not create records or call cloud providers.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', 'src/services/content-modes.test.ts', 'src/services/subtitle-pipeline.content-modes.test.ts', '--maxWorkers=2',
], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
