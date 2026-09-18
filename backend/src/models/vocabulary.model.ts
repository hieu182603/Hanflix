import { Schema, model, type InferSchemaType } from 'mongoose';

const exampleSchema = new Schema({
  chinese: { type: String, required: true, trim: true },
  pinyin: { type: String, trim: true },
  vietnamese: { type: String, trim: true },
  english: { type: String, trim: true },
}, { _id: false });

const sourceSchema = new Schema({
  name: { type: String, required: true, trim: true },
  sourceId: { type: String, trim: true },
}, { _id: false });

const vocabularySchema = new Schema({
  simplified: { type: String, required: true, trim: true, index: true },
  traditional: { type: String, trim: true },
  pinyin: { type: String, required: true, trim: true, index: true },
  pinyinNumbered: { type: String, trim: true },

  meanings: {
    vi: { type: [String], default: [] },
    en: { type: [String], default: [] },
  },

  hskLevel: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator(v: any) {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, '7-9'].includes(v) || ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(String(v));
      },
      message: 'hskLevel must be between 1 and 9, or "7-9"',
    },
    index: true,
  },

  partOfSpeech: { type: [String], default: [] },
  variants: { type: [String], default: [] },
  examples: { type: [exampleSchema], default: [] },
  frequency: { type: Number, min: 0 },
  tags: { type: [String], default: [], index: true },

  source: { type: [sourceSchema], default: [] },

  status: {
    type: String,
    enum: ['published', 'draft', 'pending_review'],
    default: 'published',
    index: true,
  },
}, { timestamps: true, versionKey: false });

// Compound unique index on simplified + pinyin to guarantee idempotency and accommodate polyphones
vocabularySchema.index({ simplified: 1, pinyin: 1 }, { unique: true });

// Query indexes for catalog search & filtering
vocabularySchema.index({ hskLevel: 1, status: 1 });
vocabularySchema.index({ status: 1, simplified: 1 });


export type Vocabulary = InferSchemaType<typeof vocabularySchema>;
export const VocabularyModel = model('Vocabulary', vocabularySchema);
