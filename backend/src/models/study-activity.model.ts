import { Schema, model, type InferSchemaType } from 'mongoose';

const studyActivitySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  activeStudySeconds: { type: Number, min: 0, default: 0 },
  progressUpdates: { type: Number, min: 0, default: 0 },
  quizAttempts: { type: Number, min: 0, default: 0 },
  completedLessons: { type: Number, min: 0, default: 0 },
  flashcardCompleted: { type: Boolean, default: false },
  vocabReviews: { type: Number, min: 0, default: 0 },
  xpEarned: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });

studyActivitySchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export type StudyActivity = InferSchemaType<typeof studyActivitySchema>;
export const StudyActivityModel = model('StudyActivity', studyActivitySchema);
