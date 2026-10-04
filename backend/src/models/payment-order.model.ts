import { Schema, model } from 'mongoose';

const schema = new Schema({
  orderCode: { type: Number, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  idempotencyKey: { type: String, required: true },
  planCode: { type: String, required: true },
  planName: { type: String, required: true },
  planRevision: { type: Number, required: true },
  durationMonths: { type: Number, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  status: { type: String, enum: ['CREATING', 'PENDING', 'UNDERPAID', 'PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'], default: 'CREATING' },
  paymentLinkId: String,
  checkoutUrl: String,
  qrCode: String,
  bin: String,
  accountNumber: String,
  accountName: String,
  description: String,
  expiresAt: { type: Date, required: true },
  paidAt: Date,
  premiumExpiresAt: Date,
}, { timestamps: true, versionKey: false });

schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, status: 1 });
schema.index({ status: 1, createdAt: -1 });
export const PaymentOrderModel = model('PaymentOrder', schema);
