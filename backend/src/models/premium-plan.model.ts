import { Schema, model, type Types } from 'mongoose';

export interface IPremiumPlan {
  code: string;
  name: string;
  durationMonths: number;
  price: number;
  active: boolean;
  revision: number;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<IPremiumPlan>({
  code: { type: String, required: true, unique: true, enum: ['monthly', 'quarterly', 'yearly'] },
  name: { type: String, required: true, maxlength: 80 },
  durationMonths: { type: Number, required: true, enum: [1, 3, 12] },
  price: { type: Number, required: true, min: 2000, max: 50000000, validate: Number.isSafeInteger },
  active: { type: Boolean, default: true },
  revision: { type: Number, default: 1 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

export const PremiumPlanModel = model<IPremiumPlan>('PremiumPlan', schema);
