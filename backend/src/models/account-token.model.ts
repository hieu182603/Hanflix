import { Schema, model, type InferSchemaType } from 'mongoose';

const accountTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
}, { timestamps: true, versionKey: false });

accountTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
accountTokenSchema.index({ userId: 1, purpose: 1, usedAt: 1 });

export type AccountToken = InferSchemaType<typeof accountTokenSchema>;
export const AccountTokenModel = model('AccountToken', accountTokenSchema);
