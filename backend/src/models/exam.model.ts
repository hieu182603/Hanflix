import { Schema, model, type InferSchemaType } from 'mongoose';

export const examSkills = ['listening', 'reading', 'writing'] as const;
export const questionTypes = ['single_choice', 'true_false', 'sentence_ordering', 'fill_in_blank'] as const;
export const examCategories = ['full_mock', 'mini_test', 'skill_listening', 'skill_reading', 'skill_writing'] as const;

export const examQuestionSchema = new Schema({
  id: { type: String, required: true },
  order: { type: Number, required: true, min: 1 },
  type: { type: String, enum: questionTypes, required: true },
  skill: { type: String, enum: examSkills, required: true },
  part: { type: Number, required: true, min: 1 },
  instruction: { type: String, required: true },
  promptText: String,
  dialogue: { type: [new Schema({ speaker: String, text: String, pinyin: String }, { _id: false })], default: undefined },
  audioUrl: String,
  imageUrl: String,
  options: { type: [String], default: undefined },
  sentenceChunks: { type: [String], default: undefined },
  correctAnswer: { type: String, required: true, select: false },
  acceptedAnswers: { type: [String], default: undefined, select: false },
  explanationVi: { type: String, required: true, select: false },
  pinyinScript: String,
  translationVi: { type: String, select: false },
  grammarPoint: { type: String, select: false },
  recommendedLessonTitle: { type: String, select: false },
  recommendedLessonId: { type: String, select: false },
}, { _id: false });

const examSectionSchema = new Schema({
  skill: { type: String, enum: examSkills, required: true },
  title: { type: String, required: true },
  totalQuestions: { type: Number, required: true, min: 1 },
  durationMinutes: { type: Number, required: true, min: 1 },
  audioUrl: String,
  instructions: { type: String, required: true },
  questions: { type: [examQuestionSchema], required: true },
}, { _id: false });

export const examSchema = new Schema({
  code: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  level: { type: Number, required: true, min: 1, max: 6, index: true },
  category: { type: String, enum: examCategories, required: true },
  durationMinutes: { type: Number, required: true, min: 1 },
  totalQuestions: { type: Number, required: true, min: 1 },
  totalScore: { type: Number, required: true },
  passingScore: { type: Number, required: true },
  description: { type: String, default: '' },
  attemptCount: { type: Number, default: 0, min: 0 },
  isPublished: { type: Boolean, default: true, index: true },
  sections: { type: [examSectionSchema], required: true },
}, { timestamps: true, versionKey: false });

export type Exam = InferSchemaType<typeof examSchema>;
export const ExamModel = model('Exam', examSchema);
