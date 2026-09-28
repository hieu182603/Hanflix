import { Schema, model } from 'mongoose';

// One bounded request/answer pair per document; no growing array on a session.
const schema = new Schema({
  _id: { type: String, required: true },
  conversationId: { type: String, required: true, ref: 'AiConversation' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fingerprint: { type: String, required: true },
  question: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  response: { type: Schema.Types.Mixed },
}, { timestamps: true, versionKey: false });
schema.index({ conversationId: 1, userId: 1, status: 1, createdAt: -1 });
export const AiMessageModel = model('AiMessage', schema);
