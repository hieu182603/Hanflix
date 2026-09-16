import { Schema, model, type InferSchemaType } from 'mongoose';

const refreshSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jti: { type: String, required: true, unique: true, index: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date },
  replacedByJti: { type: String },
  userAgent: { type: String, maxlength: 500 },
  ip: { type: String, maxlength: 100 },
}, { timestamps: true, versionKey: false });

export type RefreshSession = InferSchemaType<typeof refreshSessionSchema>;
export const RefreshSessionModel = model('RefreshSession', refreshSessionSchema);
