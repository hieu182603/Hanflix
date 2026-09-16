import { Schema, model, type InferSchemaType } from 'mongoose';

const processingJobSchema = new Schema({
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
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
  errorCode: { type: String },
  errorMessage: { type: String, maxlength: 1000 },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true, versionKey: false });

processingJobSchema.index({ status: 1, createdAt: 1 });
processingJobSchema.index({ lessonId: 1, status: 1 });

export type ProcessingJob = InferSchemaType<typeof processingJobSchema>;
export const ProcessingJobModel = model('ProcessingJob', processingJobSchema);
