import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
/**
 * CONTENT MODE (2026-09-22): migration — backfill contentMode field.
 *
 * Purpose
 *   Lessons ingested before this feature shipped don't have a `contentMode`
 *   field. MongoDB schema default is 'lesson' (set when documents are loaded
 *   by Mongoose), but persisted docs in the database are missing the field
 *   entirely. This script backfills them to 'lesson' so admin filter,
 *   pipeline branching, and player routing work consistently.
 *
 * Idempotency
 *   The migration only writes documents where `contentMode` is missing.
 *   Re-running is a no-op once every lesson has the field set.
 *
 * CLI flags
 *   --dry-run   Count documents that would be updated. Exits 0.
 *   --limit <n> Cap the number of documents updated in this run.
 *
 * Running
 *   tsx scripts/migrate-content-mode.ts --dry-run
 *   tsx scripts/migrate-content-mode.ts
 *   tsx scripts/migrate-content-mode.ts --limit 100
 */
import { LessonModel } from '../src/models/lesson.model.js';
import { logger } from '../src/services/logger.js';

interface CliArgs {
  dryRun: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: argv.includes('--dry-run') };
  const limitFlag = argv.indexOf('--limit');
  if (limitFlag !== -1) {
    const value = Number(argv[limitFlag + 1]);
    if (!Number.isInteger(value) || value <= 0) throw new Error('--limit phải là số nguyên dương');
    args.limit = value;
  }
  return args;
}

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  const args = parseArgs(process.argv.slice(2));
  // Match docs where contentMode is missing OR not one of the supported values.
  // Using $exists false keeps the migration idempotent — once backfilled,
  // no doc matches.
  const filter = {
    $or: [
      { contentMode: { $exists: false } },
      { contentMode: null as unknown as undefined },
    ],
  };
  const totalToUpdate = await LessonModel.countDocuments(filter);
  if (args.dryRun) {
    logger.info({ totalToUpdate }, '[migrate-content-mode] DRY-RUN: would update');
    return;
  }

  const limit = args.limit ?? totalToUpdate;
  const docs = await LessonModel.find(filter).select('_id').limit(limit).lean();
  logger.info({ count: docs.length, totalToUpdate }, '[migrate-content-mode] starting');

  let updated = 0;
  for (const doc of docs) {
    await LessonModel.updateOne(
      { _id: doc._id, ...filter },
      { $set: { contentMode: 'lesson' } },
    );
    updated += 1;
  }
  logger.info({ updated, totalToUpdate }, '[migrate-content-mode] DONE');
}

main().finally(() => mongoose.disconnect()).then(
  () => process.exit(0),
  error => {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '[migrate-content-mode] FAILED');
    process.exit(1);
  },
);
