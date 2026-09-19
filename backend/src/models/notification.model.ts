import { Schema, model, type InferSchemaType } from 'mongoose';

const localizedStringSchema = new Schema({
  vi: { type: String, required: true, trim: true },
  en: { type: String, default: '', trim: true },
  zh: { type: String, default: '', trim: true },
}, { _id: false });

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['streak', 'lesson', 'quiz', 'vocab', 'video_pipeline', 'system'],
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: ['study', 'system'],
    required: true,
    default: 'study',
    index: true,
  },
  title: { type: localizedStringSchema, required: true },
  message: { type: localizedStringSchema, required: true },
  isRead: { type: Boolean, default: false, index: true },
  actionUrl: { type: String, required: false, trim: true },
  actionText: { type: localizedStringSchema, required: false },
  metadata: { type: Schema.Types.Mixed, required: false },
  /**
   * Ngày tự động xóa (TTL). Khi null/undefined → notification là "quan
   * trọng", không bao giờ expire (quiz result, lesson publish). Khi set,
   * MongoDB TTL sẽ xóa doc khi expiresAt < now.
   *
   * Service set expiresAt cho: welcome (30d), video_pipeline admin (7d),
   * system reminders (90d). Quiz/lesson/vocab/streak KHÔNG set.
   */
  expiresAt: { type: Date, required: false },
}, {
  timestamps: true,
  versionKey: false,
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// TTL index: auto-delete notifications khi `expiresAt` đến. Field này chỉ
// set khi notification thuộc loại "ephemeral" (welcome, video_pipeline,
// system reminders). Notifications quan trọng (quiz result, lesson
// publish) KHÔNG set expiresAt và sẽ tồn tại vĩnh viễn cho đến khi user
// tự xóa hoặc mark-as-read xong rồi archive.
//
// `expireAfterSeconds: 0` nghĩa là MongoDB sẽ xóa ngay khi `expiresAt` < now.
// `partialFilterExpression` giúp index chỉ cover documents có field này,
// tiết kiệm storage cho phần lớn notifications không có TTL.
notificationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: 'date' } },
  },
);

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;
export const NotificationModel = model('Notification', notificationSchema);
