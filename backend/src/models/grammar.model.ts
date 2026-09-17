import { Schema, model, type InferSchemaType } from 'mongoose';

const exampleSchema = new Schema({
  chinese: { type: String, required: true, trim: true },
  pinyin: { type: String, trim: true },
  vietnamese: { type: String, trim: true },
  english: { type: String, trim: true },
}, { _id: false });

const grammarSchema = new Schema({
  code: { type: String, trim: true, index: true },
  structure: { type: String, required: true, trim: true, index: true },
  pattern: { type: String, trim: true },
  group: { type: String, trim: true, default: 'Ngữ pháp' },
  category: { type: String, trim: true },
  details: { type: String, trim: true },

  explanationVi: { type: String, required: true, trim: true },
  explanationEn: { type: String, trim: true },

  hskLevel: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator(v: any) {
        return [1, 2, 3, 4, 5, 6, '7-9'].includes(v) || ['1', '2', '3', '4', '5', '6'].includes(String(v));
      },
      message: 'hskLevel must be 1, 2, 3, 4, 5, 6 or "7-9"',
    },
    index: true,
  },

  examples: { type: [exampleSchema], default: [] },
  tags: { type: [String], default: [] },

  status: {
    type: String,
    enum: ['published', 'draft', 'pending_review'],
    default: 'published',
    index: true,
  },
}, { timestamps: true, versionKey: false });

// Query indexes
grammarSchema.index({ hskLevel: 1, status: 1 });
grammarSchema.index({ structure: 1, hskLevel: 1 });

export type Grammar = InferSchemaType<typeof grammarSchema>;
export const GrammarModel = model('Grammar', grammarSchema);
