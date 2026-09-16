import { Schema, model, type InferSchemaType } from 'mongoose';

const learningProfileSchema = new Schema({
  currentHsk: { type: Number, min: 1, max: 6 },
  currentHskSource: { type: String, enum: ['unknown', 'self_reported', 'assessed'], default: 'unknown' },
  targetHsk: { type: Number, min: 1, max: 6 },
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
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'locked'], default: 'active', index: true },
  avatarUrl: { type: String, trim: true },
  learningProfile: { type: learningProfileSchema, default: () => ({ currentHskSource: 'unknown', subtitlePreference: 'all' }) },
}, { timestamps: true, versionKey: false });

userSchema.index({ name: 'text', email: 'text' });

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
