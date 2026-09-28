import { Schema, model, type InferSchemaType } from 'mongoose';

const questionSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['choice', 'short_answer'], required: true },
  prompt: { type: String, required: true },
  audioUrl: String,
  options: { type: [{ id: String, text: String, _id: false }], default: [] },
  correctOptionId: String,
  acceptedAnswers: { type: [String], default: [] },
  explanation: { type: String, required: true },
}, { _id: false });

// Attempts retain strict question snapshots. Only authoring drafts permit blank text.
const draftQuestionSchema = questionSchema.clone();
draftQuestionSchema.path('prompt').required(false);
draftQuestionSchema.path('explanation').required(false);

const practiceSetSchema = new Schema({
  title: { type: String, required: true },
  hsk: { type: Number, required: true, min: 1, max: 9 },
  skill: { type: String, enum: ['vocabulary', 'listening', 'reading', 'writing'], required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  revision: { type: Number, default: 1 },
  durationSeconds: { type: Number, required: true },
  questions: { type: [draftQuestionSchema], required: true },
}, { timestamps: true, versionKey: false });
practiceSetSchema.index({ status: 1, hsk: 1, skill: 1 });

const practiceAttemptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  setId: { type: Schema.Types.ObjectId, ref: 'PracticeSet', required: true },
  requestKey: { type: String, required: true },
  openKey: String,
  rewardKey: String,
  title: { type: String, required: true },
  hsk: { type: Number, required: true },
  skill: { type: String, required: true },
  setRevision: { type: Number, required: true },
  questions: { type: [questionSchema], required: true },
  answers: { type: Map, of: String, default: {} },
  flagged: { type: [String], default: [] },
  version: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  submittedAt: Date,
  dateKey: String,
  score: Number,
  correctCount: Number,
  rewardXp: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });
practiceAttemptSchema.index({ userId: 1, requestKey: 1 }, { unique: true });
practiceAttemptSchema.index({ openKey: 1 }, { unique: true, sparse: true });
practiceAttemptSchema.index({ rewardKey: 1 }, { unique: true, sparse: true });
practiceAttemptSchema.index({ userId: 1, createdAt: -1 });
practiceAttemptSchema.index({ status: 1, dateKey: 1, userId: 1 });

export type PracticeSet = InferSchemaType<typeof practiceSetSchema>;
export type PracticeAttempt = InferSchemaType<typeof practiceAttemptSchema>;
export const PracticeSetModel = model('PracticeSet', practiceSetSchema);
export const PracticeAttemptModel = model('PracticeAttempt', practiceAttemptSchema);
