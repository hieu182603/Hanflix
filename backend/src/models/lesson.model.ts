import { Schema, model, type InferSchemaType } from 'mongoose';

const mediaSchema = new Schema({
  objectKey: { type: String, required: true },
  mimeType: { type: String, enum: ['video/mp4', 'video/webm'], required: true },
  sizeBytes: { type: Number, min: 1, required: true },
  etag: { type: String },
}, { _id: false });

const subtitleStyleSchema = new Schema({
  chineseFontSize: { type: Number, min: 16, max: 96, default: 34 },
  pinyinFontSize: { type: Number, min: 12, max: 64, default: 20 },
  vietnameseFontSize: { type: Number, min: 12, max: 64, default: 22 },
}, { _id: false });

const lessonSchema = new Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  titleVi: { type: String, required: true, trim: true, maxlength: 160 },
  titleZh: { type: String, trim: true, maxlength: 160 },
  pinyin: { type: String, trim: true, maxlength: 240 },
  descriptionVi: { type: String, required: true, trim: true, maxlength: 1000 },
  hsk: { type: Number, required: true, min: 1, max: 9, index: true },
  subtitleStyle: { type: subtitleStyleSchema },
  // Optional override for AI-generated quiz question count. When set (1-15),
  // the auto-trigger uses this value instead of the HSK-based heuristic.
  // Undefined / null → use HSK heuristic.
  autoGenerateQuizCount: { type: Number, min: 1, max: 15 },
  topicIds: [{ type: String, required: true, trim: true, index: true }],
  goalTags: [{ type: String, enum: ['daily', 'travel', 'work', 'hsk', 'culture', 'other'] }],
  durationSeconds: { type: Number, required: true, min: 60, max: 300 },
  status: {
    type: String,
    enum: ['draft', 'uploading', 'processing', 'ready_for_review', 'published', 'hidden', 'failed'],
    default: 'draft',
    index: true,
  },
  processingStatus: {
    type: String,
    enum: ['UPLOADED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'],
    index: true,
  },
  processingProgress: { type: Number, min: 0, max: 100, default: 0 },
  processingStep: {
    type: String,
    enum: ['UPLOADING', 'QUEUED', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'GENERATING_PINYIN', 'TRANSLATING', 'SAVING', 'COMPLETED', 'FAILED'],
  },
  processingError: { type: String, maxlength: 1000 },
  sourceLanguage: { type: String, trim: true, default: 'zh-CN' },
  media: { type: mediaSchema },
  pendingUploadObjectKey: { type: String, trim: true, select: false },
  thumbnailKey: { type: String, trim: true },
  activeSubtitleRevision: { type: Number, min: 1 },
  activeQuizRevision: { type: Number, min: 1 },
  publishedAt: { type: Date, index: true },
  hiddenAt: { type: Date },
  hiddenBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // F06 fix (2026-09-18): flag to indicate that subtitle/quiz content was edited
  // and downstream artifacts (translation, pinyin, word links, quiz answers) may
  // need re-review. Reset to false on publish.
  contentDirty: { type: Boolean, default: false, index: true },
  contentDirtyReason: { type: String, maxlength: 500 },
}, { timestamps: true, versionKey: false });

lessonSchema.index({ titleVi: 'text', titleZh: 'text', pinyin: 'text', descriptionVi: 'text' });
lessonSchema.index({ status: 1, hsk: 1, topicIds: 1, publishedAt: -1 });

export type Lesson = InferSchemaType<typeof lessonSchema>;
export const LessonModel = model('Lesson', lessonSchema);
