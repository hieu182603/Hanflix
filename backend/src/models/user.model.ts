import { Schema, model, type InferSchemaType } from 'mongoose';

const learningProfileSchema = new Schema({
  currentHsk: { type: Number, min: 1, max: 9 },
  currentHskSource: { type: String, enum: ['unknown', 'self_reported', 'assessed'], default: 'unknown' },
  targetHsk: { type: Number, min: 1, max: 9 },
  goal: {
    type: String,
    enum: ['daily', 'travel', 'work', 'hsk', 'culture', 'other'],
  },
  focusSkills: [{ type: String, enum: ['listening', 'reading', 'vocabulary', 'sentence_usage', 'unknown'] }],
  topicIds: [{ type: String, trim: true }],
  dailyMinutes: { type: Number, min: 5, max: 120 },
  studyDaysPerWeek: { type: Number, min: 1, max: 7 },
  subtitlePreference: {
    type: String,
    enum: ['all', 'zh_pinyin', 'zh_vi', 'zh_only', 'unknown'],
    default: 'all',
  },
  surveyVersion: { type: Number, min: 1 },
}, { _id: false });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, select: false },
  googleSub: { type: String, unique: true, sparse: true, select: false },
  // SECURITY (C-4): Tracks when Google was linked, used by the OTP-grace-window check
  // in /auth/google to prevent account takeover via OAuth auto-link.
  googleLinkedAt: { type: Date },
  emailVerifiedAt: { type: Date },
  emailVerificationRequired: { type: Boolean, default: false, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'locked'], default: 'active', index: true },
  avatarUrl: { type: String, trim: true },
  googleAvatarUrl: { type: String, trim: true },
  avatarType: { type: String, enum: ['generated', 'custom'], default: 'generated' },
  avatarConfig: { type: Schema.Types.Mixed, default: null },
  avatarPublicId: { type: String, trim: true, default: null },
  totalXP: { type: Number, min: 0, default: 0 },
  premiumExpiresAt: { type: Date, default: null },
  premiumReceipts: { type: [{
      orderCode: { type: Number },
      grantId: String,
      grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      planCode: String,
      durationMonths: Number,
      reason: String,
      grantedAt: Date,
    expiresAt: { type: Date, required: true },
    _id: false,
  }], select: false, default: [] },
  learningProfile: { type: learningProfileSchema, default: () => ({ currentHskSource: 'unknown', subtitlePreference: 'all' }) },
}, { timestamps: true, versionKey: false });

userSchema.index({ name: 'text', email: 'text' });

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
