import { Schema, model, type InferSchemaType } from 'mongoose';

const tokenSchema = new Schema({
  text: { type: String, required: true },
  wordId: { type: Schema.Types.ObjectId, ref: 'Word', default: null },
}, { _id: false });

const cueSchema = new Schema({
  cueId: { type: String, required: true },
  startMs: { type: Number, required: true, min: 0 },
  endMs: { type: Number, required: true, min: 1 },
  zh: { type: String, required: true },
  pinyin: { type: String, required: true },
  vi: { type: String, required: true },
  tokens: { type: [tokenSchema], default: [] },
}, { _id: false });

const subtitleTrackSchema = new Schema({
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  revision: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  cues: { type: [cueSchema], default: [] },
  generatedBy: { type: String, enum: ['manual', 'pipeline', 'fixture'], default: 'manual' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  // Gemini-generated learning tips tailored to this track's cues.
  // Empty array means tips have not been generated yet.
  learningTips: {
    type: [{
      title: { type: String, required: true, maxlength: 60 },
      detail: { type: String, required: true, maxlength: 300 },
      cueId: { type: String, maxlength: 64 },
    }],
    default: [],
  },
  // Words worth drilling after watching this lesson, in priority order.
  drillWords: { type: [String], default: [] },
  // Set true once Gemini has polished the .vi fields (Azure → Gemini).
  // Lets the admin UI badge cues that were rewritten by AI.
  translationImproved: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });

subtitleTrackSchema.index({ lessonId: 1, revision: 1 }, { unique: true });

export type SubtitleTrack = InferSchemaType<typeof subtitleTrackSchema>;
export const SubtitleTrackModel = model('SubtitleTrack', subtitleTrackSchema);
