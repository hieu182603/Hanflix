import { Schema, model, type InferSchemaType } from 'mongoose';

const processingJobSchema = new Schema({
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  objectKey: { type: String },
  activeKey: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['queued', 'running', 'failed', 'completed'], default: 'queued', index: true },
  stage: {
    type: String,
    enum: ['inspect_media', 'transcribe_zh', 'generate_pinyin', 'translate_vi', 'extract_vocabulary', 'generate_quiz', 'finalize'],
    default: 'inspect_media',
  },
  stageProgress: { type: Number, min: 0, max: 100 },
  attempts: { type: Number, min: 0, default: 0 },
  lockedAt: { type: Date },
  lockedBy: { type: String },
  // F04 fix (2026-09-18): leaseToken — a per-attempt UUID assigned at claim time.
  // Every subsequent mutation (heartbeat / stage update / finish / fail) must present
  // this token via `leaseToken` in the filter. If a different worker tries to mutate
  // the job (e.g. stale recovery claimed it back into the queue, or a second worker
  // somehow got hold of it), the mutation is a no-op and the caller's identity is
  // exposed via `matchedCount: 0`. This makes the queue idempotent under racing
  // workers even within the same heartbeat window.
  leaseToken: { type: String, index: true },
  // F04: stageDeadlineAt — when the current stage must finish by. After this
  // moment, the worker is considered stuck and the next claim cycle will mark
  // the job stale and recover it.
  stageDeadlineAt: { type: Date },
  // F04: leaseExpiresAt — when the lease itself (regardless of stage) must be
  // renewed. Worker must heartbeat before this moment; otherwise the lease is
  // considered abandoned even if stage progress was being reported.
  leaseExpiresAt: { type: Date },
  heartbeatAt: { type: Date },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  // F04: stageStartedAt — set whenever the pipeline enters a new stage. Used
  // by the orchestrator to compute progress vs. expected stage duration.
  stageStartedAt: { type: Date },
  errorCode: { type: String },
  errorMessage: { type: String, maxlength: 1000 },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true, versionKey: false });

processingJobSchema.index({ status: 1, createdAt: 1 });
processingJobSchema.index({ lessonId: 1, status: 1 });
processingJobSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
processingJobSchema.index({ status: 1, leaseExpiresAt: 1 });

export type ProcessingJob = InferSchemaType<typeof processingJobSchema>;
export const ProcessingJobModel = model('ProcessingJob', processingJobSchema);
