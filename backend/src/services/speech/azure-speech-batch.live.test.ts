import { expect, it } from 'vitest';
import fs from 'node:fs/promises';
import { azureSpeechBatchWhisperProvider } from './azure-speech-batch.service.js';

it.skipIf(process.env.RUN_AZURE_INTEGRATION_TESTS !== 'true')('opt-in live Azure Batch, with durable intent and no automatic resubmission', async () => {
  await fs.mkdir('.runtime', { recursive: true });
  const file = '.runtime/azure-live-state.json';
  const state = await fs.readFile(file, 'utf8').then(text => JSON.parse(text) as { displayName: string; submissionStarted?: boolean; transcriptionUrl?: string })
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { displayName: `hanflix-live-verification-${Date.now()}`, submissionStarted: false, transcriptionUrl: undefined };
    });
  if (!state.displayName || typeof state.submissionStarted !== 'boolean') throw new Error('Invalid live checkpoint; reconcile existing Azure submissions before repairing it');
  const url = process.env.AZURE_TEST_AUDIO_URL;
  if (!url && !state.submissionStarted && !state.transcriptionUrl) throw new Error('AZURE_TEST_AUDIO_URL is required for the first live test');
  const persist = async () => {
    await fs.writeFile(`${file}.tmp`, JSON.stringify(state));
    await fs.rename(`${file}.tmp`, file);
  };
  const result = await azureSpeechBatchWhisperProvider.transcribeFromUrl(url ?? '', AbortSignal.timeout(900_000), {
    ...state,
    beforeSubmit: async () => { state.submissionStarted = true; await persist(); },
    onSubmitted: async self => { state.transcriptionUrl = self; await persist(); },
    onRawResult: raw => fs.writeFile('.runtime/azure-live-raw.json', JSON.stringify(raw)),
  });
  expect(result.segments.length).toBeGreaterThan(0);
}, 910_000);
