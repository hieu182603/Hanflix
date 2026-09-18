import { Schema, model, type InferSchemaType } from 'mongoose';

const exampleSchema = new Schema({
  zh: { type: String, required: true },
  pinyin: { type: String, required: true },
  vi: { type: String, required: true },
}, { _id: false });

const wordSchema = new Schema({
  hanzi: { type: String, required: true, trim: true, index: true },
  pinyin: { type: String, required: true, trim: true },
  // F12 (2026-09-18): meaningVi is now optional so we can insert words that came
  // from the subtitle pipeline without a HSK match (they get `needsReview=true`).
  // Existing rows with required meaningVi still validate against the schema (the
  // field accepts both null and string at the application level).
  meaningVi: { type: String, trim: true, default: null },
  partOfSpeech: { type: String, trim: true },
  examples: { type: [exampleSchema], default: [] },
  audioKey: { type: String, trim: true },
  // F12: marks words whose meaning came from a context fallback or is still
  // pending review by an admin. Admin routes can filter /vocabulary/words by this.
  needsReview: { type: Boolean, default: false, index: true },
  // F12: links to the lesson that introduced this word, for traceability.
  introducedInLessons: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }],
}, { timestamps: true, versionKey: false });

wordSchema.index({ hanzi: 1, pinyin: 1, meaningVi: 1 }, { unique: true });

export type Word = InferSchemaType<typeof wordSchema>;
export const WordModel = model('Word', wordSchema);
