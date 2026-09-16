import { Schema, model, type InferSchemaType } from 'mongoose';

const answerSchema = new Schema({
  questionId: { type: String, required: true },
  selectedOptionId: { type: String },
  textAnswer: { type: String },
  correct: { type: Boolean, required: true },
}, { _id: false });

const quizAttemptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  idempotencyKey: { type: String, required: true },
  answers: { type: [answerSchema], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  correctCount: { type: Number, required: true, min: 0 },
  totalCount: { type: Number, required: true, min: 1 },
}, { timestamps: true, versionKey: false });

quizAttemptSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
quizAttemptSchema.index({ userId: 1, lessonId: 1, createdAt: -1 });

export type QuizAttempt = InferSchemaType<typeof quizAttemptSchema>;
export const QuizAttemptModel = model('QuizAttempt', quizAttemptSchema);
