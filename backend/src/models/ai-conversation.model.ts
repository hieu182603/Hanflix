import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null },
  subtitleRevision: { type: Number, default: null },
  pendingRequest: { type: String, default: null },
  lockedUntil: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, updatedAt: -1 });
export const AiConversationModel = model('AiConversation', schema);
