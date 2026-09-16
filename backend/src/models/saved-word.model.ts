import { Schema, model, type InferSchemaType } from 'mongoose';

const savedWordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  wordId: { type: Schema.Types.ObjectId, ref: 'Word', required: true, index: true },
  sourceLessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
  sourceCueId: { type: String, required: true },
  repetitions: { type: Number, min: 0, default: 0 },
  intervalDays: { type: Number, min: 0, default: 0 },
  easeFactor: { type: Number, min: 1.3, default: 2.5 },
  nextReviewAt: { type: Date, required: true, default: Date.now, index: true },
  lastReviewedAt: { type: Date },
  lastRating: { type: String, enum: ['again', 'hard', 'good', 'easy'] },
}, { timestamps: true, versionKey: false });

savedWordSchema.index({ userId: 1, wordId: 1 }, { unique: true });
savedWordSchema.index({ userId: 1, nextReviewAt: 1 });

export type SavedWord = InferSchemaType<typeof savedWordSchema>;
export const SavedWordModel = model('SavedWord', savedWordSchema);
