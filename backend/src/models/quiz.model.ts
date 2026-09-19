import { Schema, model, type InferSchemaType } from 'mongoose';

const optionSchema = new Schema({
  optionId: { type: String, required: true },
  text: { type: String, required: true },
}, { _id: false });

const questionSchema = new Schema({
  questionId: { type: String, required: true },
  type: { type: String, enum: ['multiple_choice', 'fill_blank'], required: true },
  prompt: { type: String, required: true },
  cueId: { type: String },
  options: { type: [optionSchema], default: [] },
  correctOptionId: { type: String, select: false },
  acceptedAnswers: { type: [String], default: undefined, select: false },
  explanationVi: { type: String, required: true, select: false },
  relatedWordIds: [{ type: Schema.Types.ObjectId, ref: 'Word' }],
}, { _id: false });

const quizSchema = new Schema({
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  revision: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  questions: { type: [questionSchema], default: [] },
  // AI generation tracking fields. Set when the post-pipeline auto-trigger fires.
  // 'pending' = job queued, 'running' = Gemini call in flight, 'completed' = questions replaced, 'failed' = error logged.
  aiGenerationStatus: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'skipped' },
  aiGenerationStartedAt: { type: Date },
  aiGenerationCompletedAt: { type: Date },
  aiGenerationError: { type: String, maxlength: 1000 },
  aiGenerationKinds: { type: [String], default: undefined },
  aiGenerationQuestionCount: { type: Number },
}, { timestamps: true, versionKey: false });

quizSchema.index({ lessonId: 1, revision: 1 }, { unique: true });

export type Quiz = InferSchemaType<typeof quizSchema>;
export const QuizModel = model('Quiz', quizSchema);
