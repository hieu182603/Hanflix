import { Schema, model, type InferSchemaType } from 'mongoose';

const exampleSchema = new Schema({
  zh: { type: String, required: true },
  pinyin: { type: String, required: true },
  vi: { type: String, required: true },
}, { _id: false });

const wordSchema = new Schema({
  hanzi: { type: String, required: true, trim: true, index: true },
  pinyin: { type: String, required: true, trim: true },
  meaningVi: { type: String, required: true, trim: true },
  partOfSpeech: { type: String, trim: true },
  examples: { type: [exampleSchema], default: [] },
  audioKey: { type: String, trim: true },
}, { timestamps: true, versionKey: false });

wordSchema.index({ hanzi: 1, pinyin: 1, meaningVi: 1 }, { unique: true });

export type Word = InferSchemaType<typeof wordSchema>;
export const WordModel = model('Word', wordSchema);
