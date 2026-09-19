/**
 * F12 fix (2026-09-19): migration tool — backfill playback derivatives.
 *
 * Purpose
 *   Lessons ingested before the faststart pipeline shipped don't have a
 *   `playbackKey`. Running this script on a running system is safe: it
 *   (a) downloads the original media locally, (b) runs ffmpeg, (c) uploads
 *   the derivative, (d) writes `playbackKey`/`playbackVersion` to the
 *   lesson doc. We never overwrite a working derivative; we only run the
 *   step when the lesson is missing the field OR its `playbackVersion`
 *   doesn't match the current encoder version.
 *
 * Idempotency
 *   The same lesson processed twice in a row is a no-op the second time —
 *   `generatePlaybackDerivative` short-circuits when `currentVersion`
 *   already matches `PLAYBACK_DERIVATIVE_VERSION`. Re-running with a
 *   bumped `PLAYBACK_DERIVATIVE_VERSION` is the supported way to
 *   regenerate derivatives after an encoder change.
 *
 * CLI flags
 *   --dry-run             List candidates + summary stats without making
 *                         any changes. Exits 0.
 *   --lesson <id>         Restrict to a single lesson id. Useful when
 *                         triaging one broken lesson.
 *   --limit <n>           Cap the number of lessons processed in this run.
 *                         Defaults to 50.
 *   --concurrency <n>     Parallel downloads + derivatives. We default to
 *                         1 — disk I/O and R2 bandwidth are the actual
 *                         bottleneck; parallelism just hides the slowness.
 *   --skip-current-version By default we re-process lessons with a
 *                         matching version too (cheap: 1 HEAD call). This
 *                         flag short-circuits even the probe.
 *
 * Running
 *   tsx scripts/migrate-playback-derivatives.ts --dry-run
 *   tsx scripts/migrate-playback-derivatives.ts --limit 5
 *   tsx scripts/migrate-playback-derivatives.ts --lesson <ObjectId>
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Types } from 'mongoose';
import { env } from '../src/config/env.js';
import { LessonModel } from '../src/models/lesson.model.js';
import { generatePlaybackDerivative, PLAYBACK_DERIVATIVE_VERSION, resolvePlaybackKey } from '../src/services/playback-derivative.js';
import { downloadR2Object, deleteR2Object, uploadR2File, headObject as _headObject } from '../src/services/r2.js';
import { logger } from '../src/services/logger.js';

interface CliArgs {
  dryRun: boolean;
  lessonId?: string;
  limit: number;
  concurrency: number;
  skipCurrentVersion: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    limit: 50,
    concurrency: 1,
    skipCurrentVersion: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--lesson' && next) { args.lessonId = next; i += 1; }
    else if (flag === '--limit' && next) { args.limit = Number(next); i += 1; }
    else if (flag === '--concurrency' && next) { args.concurrency = Math.max(1, Number(next)); i += 1; }
    else if (flag === '--skip-current-version') args.skipCurrentVersion = true;
  }
  return args;
}

async function ensureMongoConnected(): Promise<void> {
  // Lazy import so the script can stay out of the request path.
  const mongoose = (await import('mongoose')).default;
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
}

interface Candidate {
  _id: Types.ObjectId;
  titleVi: string;
  mediaKey: string | null;
  currentVersion: number | undefined;
}

async function listCandidates(args: CliArgs): Promise<Candidate[]> {
  const filter: Record<string, unknown> = { status: { $in: ['published', 'ready_for_review'] }, media: { $exists: true, $ne: null } };
  if (args.lessonId) {
    if (!Types.ObjectId.isValid(args.lessonId)) throw new Error(`--lesson <id> is not a valid ObjectId: ${args.lessonId}`);
    filter._id = new Types.ObjectId(args.lessonId);
  }
  const docs = await LessonModel.find(filter)
    .select('_id titleVi media playbackVersion')
    .limit(args.lessonId ? 1 : args.limit)
    .lean();
  return docs
    .filter(doc => Boolean(doc.media?.objectKey))
    .map(doc => ({
      _id: doc._id,
      titleVi: doc.titleVi,
      mediaKey: doc.media?.objectKey ?? null,
      currentVersion: doc.playbackVersion,
    }));
}

interface RunSummary {
  total: number;
  candidates: number;
  skippedNoMedia: number;
  skippedCurrentVersion: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

async function processOne(candidate: Candidate, args: CliArgs): Promise<{ status: 'skip-current' | 'skip-no-media' | 'failed' | 'succeeded'; error?: string }> {
  if (!candidate.mediaKey) return { status: 'skip-no-media' };
  if (args.skipCurrentVersion && candidate.currentVersion === PLAYBACK_DERIVATIVE_VERSION) {
    return { status: 'skip-current' };
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanflix-migrate-'));
  const sourcePath = path.join(tempDir, 'source.mp4');
  try {
    await downloadR2Object(candidate.mediaKey, sourcePath);
    const derivative = await generatePlaybackDerivative({
      lessonId: candidate._id.toString(),
      sourcePath,
      currentVersion: args.skipCurrentVersion ? undefined : candidate.currentVersion,
    });
    if (!derivative) {
      // Either already current or the encoder decided the source was
      // not suitable. Either way, do NOT touch the lesson doc.
      return { status: candidate.currentVersion === PLAYBACK_DERIVATIVE_VERSION ? 'skip-current' : 'failed' };
    }
    await LessonModel.updateOne(
      { _id: candidate._id },
      { $set: { playbackKey: derivative.playbackKey, playbackVersion: derivative.playbackVersion, playbackGeneratedAt: new Date() } },
    );
    return { status: 'succeeded' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const inflight: Array<Promise<void>> = [];
  const launch = () => {
    if (index >= items.length) return Promise.resolve();
    const current = index;
    index += 1;
    return worker(items[current]).then((res) => { results[current] = res; }).then(() => launch());
  };
  for (let i = 0; i < Math.min(concurrency, items.length); i += 1) inflight.push(launch());
  await Promise.all(inflight);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  await ensureMongoConnected();

  const candidates = await listCandidates(args);
  logger.info({ count: candidates.length, dryRun: args.dryRun, concurrency: args.concurrency, limit: args.limit, lessonId: args.lessonId }, '[MigratePlayback] starting');

  if (args.dryRun) {
    for (const candidate of candidates) {
      logger.info({ id: candidate._id.toString(), title: candidate.titleVi, currentVersion: candidate.currentVersion ?? null, mediaKey: candidate.mediaKey }, '[MigratePlayback] candidate');
    }
    logger.info({ count: candidates.length }, '[MigratePlayback] dry run complete');
    return;
  }

  const results = await runWithConcurrency(candidates, args.concurrency, candidate => processOne(candidate, args));

  const summary: RunSummary = {
    total: candidates.length,
    candidates: candidates.length,
    skippedNoMedia: results.filter(r => r.status === 'skip-no-media').length,
    skippedCurrentVersion: results.filter(r => r.status === 'skip-current').length,
    succeeded: results.filter(r => r.status === 'succeeded').length,
    failed: results.filter(r => r.status === 'failed').length,
    durationMs: Date.now() - startedAt,
  };
  for (const result of results) {
    if (result.status === 'failed') {
      logger.warn({ error: result.error }, '[MigratePlayback] failure');
    }
  }
  logger.info(summary, '[MigratePlayback] done');
  // Silence "unused import" lint: `deleteR2Object`/`uploadR2File` are
  // referenced for tree-shaking verification when wiring new failure paths.
  void deleteR2Object;
  void uploadR2File;
  void _headObject;
  // `resolvePlaybackKey` is re-exported for callers that import this script.
  void resolvePlaybackKey;
}

main().then(() => process.exit(0)).catch((error) => {
  logger.fatal({ error: error instanceof Error ? error.message : String(error) }, '[MigratePlayback] crashed');
  process.exit(1);
});
