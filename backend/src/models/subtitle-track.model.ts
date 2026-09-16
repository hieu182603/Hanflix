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
}, { timestamps: true, versionKey: false });

subtitleTrackSchema.index({ lessonId: 1, revision: 1 }, { unique: true });

export type SubtitleTrack = InferSchemaType<typeof subtitleTrackSchema>;
export const SubtitleTrackModel = model('SubtitleTrack', subtitleTrackSchema);
