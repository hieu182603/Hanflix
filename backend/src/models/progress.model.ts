import { Schema, model, type InferSchemaType } from 'mongoose';

const rangeSchema = new Schema({
  start: { type: Number, required: true, min: 0 },
  end: { type: Number, required: true, min: 0 },
}, { _id: false });

const progressSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  lastPositionSeconds: { type: Number, min: 0, default: 0 },
  watchedRanges: { type: [rangeSchema], default: [] },
  activeStudySeconds: { type: Number, min: 0, default: 0 },
  completed: { type: Boolean, default: false, index: true },
  completedAt: { type: Date },
  bestQuizScore: { type: Number, min: 0, max: 100 },
}, { timestamps: true, versionKey: false });

progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export type Progress = InferSchemaType<typeof progressSchema>;
export const ProgressModel = model('Progress', progressSchema);
