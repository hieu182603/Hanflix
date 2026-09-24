import { Schema, model, type InferSchemaType } from 'mongoose';

const mediaSchema = new Schema({
  objectKey: { type: String, required: true },
  mimeType: { type: String, enum: ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'], required: true },
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
  durationSeconds: { type: Number, required: true, min: 0.01, max: 21600 },
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
  /**
   * F12 fix (2026-09-19): playback derivative metadata.
   *
   *   - `playbackKey`     — R2 object key for the faststart-friendly MP4 we
   *                         generated during pipeline processing. When
   *                         defined, the lesson endpoint returns the
   *                         derivative URL; when undefined, the original
   *                         `media.objectKey` is served (backward compat).
   *   - `playbackVersion` — monotonically increasing integer. Used by the
   *                         migration tool to skip lessons whose derivative
   *                         already matches the current encoder version,
   *                         and by the route layer to pick the latest
   *                         derivative when multiple exist.
   *
   * Never assume `playbackKey` exists: lessons ingested before F12 still
   * rely on `media.objectKey` until the migration runs.
   */
  playbackKey: { type: String, trim: true },
  playbackVersion: { type: Number, min: 1 },
  playbackGeneratedAt: { type: Date },
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
  // CONTENT MODE (2026-09-22): mở rộng ngoài bài học truyền thống.
  // - 'lesson'   — video bài học chuẩn (HSK, phụ đề song ngữ, quiz). Code path mặc định, backward compatible.
  // - 'song'     — bài hát/karaoke. Pipeline nhận LRC manual + align word-level cho karaoke highlight.
  // - 'podcast'  — podcast dài (>10 phút). Pipeline chapter detection qua Gemini.
  // - 'drama'    — clip kịch/drama. Pipeline speaker diarization, multi-speaker cue.
  // Default 'lesson' để 100% lesson cũ chạy y nguyên. Index phục vụ admin filter.
  contentMode: {
    type: String,
    enum: ['lesson', 'song', 'podcast', 'drama'],
    default: 'lesson',
    index: true,
  },
  // Pipeline v2 media classification. AUTO preserves the existing admin API
  // and lets the evaluator decide whether vocal separation is needed.
  mediaType: {
    type: String,
    enum: ['AUTO', 'MOVIE', 'PODCAST', 'MUSIC'],
    default: 'AUTO',
    index: true,
  },
  // === SONG-specific ===
  // LRC do admin cung cấp; để trống sẽ dùng ASR. Không tạo lời giả khi ASR thất bại.
  lyricsRaw: { type: String, maxlength: 20000 },
  lyricsSource: { type: String, enum: ['lrc', 'manual', 'auto'] },
  chorusSections: [{
    startMs: { type: Number, min: 0 },
    endMs: { type: Number, min: 0 },
    _id: false,
  }],
  // === PODCAST-specific ===
  chapters: [{
    chapterId: { type: String, maxlength: 100 },
    title: { type: String, maxlength: 200 },
    startMs: { type: Number, min: 0 },
    endMs: { type: Number, min: 0 },
    summary: { type: String, maxlength: 1000 },
    _id: false,
  }],
  // === DRAMA-specific ===
  characters: [{
    speakerId: { type: String, maxlength: 50 },
    displayName: { type: String, maxlength: 100 },
    descriptionVi: { type: String, maxlength: 500 },
    color: { type: String, maxlength: 20 },     // mã màu UI cho subtitle/drama player
    avatarUrl: { type: String, maxlength: 500 },
    _id: false,
  }],
}, { timestamps: true, versionKey: false });

lessonSchema.index({ titleVi: 'text', titleZh: 'text', pinyin: 'text', descriptionVi: 'text' });
lessonSchema.index({ status: 1, hsk: 1, topicIds: 1, publishedAt: -1 });
// M-4: Compound index for status + topic filter (khi user không filter theo HSK)
lessonSchema.index({ status: 1, topicIds: 1, publishedAt: -1 });
// M-4: Text search + status compound (cho query $text với filter status)
lessonSchema.index({ status: 1, publishedAt: -1 });

export type Lesson = InferSchemaType<typeof lessonSchema>;
export const LessonModel = model('Lesson', lessonSchema);
