import { Schema, model } from 'mongoose';

const examAttemptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  examCode: { type: String, required: true },
  level: { type: Number, required: true },
  answers: { type: Map, of: String, required: true },
  score: { type: Number, required: true },
  listeningScore: { type: Number, required: true },
  readingScore: { type: Number, required: true },
  writingScore: { type: Number, required: true },
  totalScore: { type: Number, required: true },
  passingScore: { type: Number, required: true },
  isPassed: { type: Boolean, required: true },
  timeSpentSeconds: { type: Number, required: true, min: 0 },
  submittedAt: { type: Date, default: Date.now },
  submissionKey: { type: String, required: true },
  // Immutable snapshot makes retries/review independent of later admin imports.
  resultJson: { type: String, required: true, select: false },
}, { versionKey: false });
examAttemptSchema.index({ userId: 1, submittedAt: -1 });
examAttemptSchema.index({ userId: 1, submissionKey: 1 }, { unique: true });
export const ExamAttemptModel = model('ExamAttempt', examAttemptSchema);
