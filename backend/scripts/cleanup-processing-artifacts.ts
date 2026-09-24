import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { ProcessingJobModel } from '../src/models/processing-job.model.js';
import { storageService } from '../src/services/storage/r2-storage.service.js';

/** Remove only v2 processing artifacts from completed/failed jobs past TTL. */
async function main() {
  await connectDatabase();
  const cutoff = new Date(Date.now() - env.PROCESSING_ARTIFACT_TTL_HOURS * 3_600_000);
  const jobs = await ProcessingJobModel.find({
    status: { $in: ['completed', 'failed'] },
    updatedAt: { $lt: cutoff },
  }).select('_id artifacts').lean();
  const active = await ProcessingJobModel.find({ status: { $in: ['queued', 'running'] } }).select('artifacts').lean();
  const activeKeys = new Set<string>();
  for (const job of active) {
    const artifacts = job.artifacts as Record<string, unknown> | undefined;
    for (const value of Object.values(artifacts ?? {})) if (typeof value === 'string') activeKeys.add(value);
  }
  let deleted = 0;
  for (const job of jobs) {
    const claimed = await ProcessingJobModel.findOneAndUpdate({
      _id: job._id, status: { $in: ['completed', 'failed'] }, updatedAt: { $lt: cutoff },
      $or: [{ artifactCleanupLockUntil: { $exists: false } }, { artifactCleanupLockUntil: { $lt: new Date() } }],
    }, { $set: { artifactCleanupLockUntil: new Date(Date.now() + 600_000) } }, { returnDocument: 'after' });
    if (!claimed) continue;
    const artifacts = job.artifacts as Record<string, unknown> | undefined;
    for (const value of Object.values(artifacts ?? {})) {
      if (typeof value !== 'string' || !value.startsWith('processing/') || activeKeys.has(value)) continue;
      await storageService.deleteObject(value);
      deleted += 1;
    }
    await ProcessingJobModel.updateOne({ _id: job._id, artifactCleanupLockUntil: claimed.artifactCleanupLockUntil }, { $unset: { artifacts: 1, artifactCleanupLockUntil: 1 } });
  }
  console.log(JSON.stringify({ scanned: jobs.length, deleted, cutoff: cutoff.toISOString() }));
  await disconnectDatabase();
}

main().catch(async error => {
  console.error('cleanup-processing-artifacts failed', error instanceof Error ? error.message : String(error));
  await disconnectDatabase();
  process.exitCode = 1;
});
