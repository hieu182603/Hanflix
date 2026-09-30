import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { addMonths } from './premium.js';

export interface AdminPremiumInput {
  planCode: 'monthly' | 'quarterly' | 'yearly';
  reason: string;
  idempotencyKey: string;
}

// The audit receipt and expiry live in the same atomic update as paid grants.
// No fake payment order is created, so manual activations do not inflate revenue.
export async function activateUserPremium(userId: Types.ObjectId, adminId: Types.ObjectId, input: AdminPremiumInput, now = new Date()) {
  let months: number | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const user = await UserModel.findById(userId).select('role status premiumExpiresAt +premiumReceipts').lean();
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
    const receipt = user.premiumReceipts?.find(item => item.grantId === input.idempotencyKey);
    if (receipt) {
      if (String(receipt.grantedBy) !== String(adminId) || receipt.planCode !== input.planCode || receipt.reason !== input.reason) {
        throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đã dùng cho lần kích hoạt khác');
      }
      return { userId, premiumExpiresAt: user.premiumExpiresAt ?? receipt.expiresAt, grant: receipt, replayed: true };
    }
    if (user.role !== 'user' || user.status !== 'active') {
      throw new AppError(409, 'USER_NOT_ELIGIBLE', 'Chỉ kích hoạt gói cho học viên đang hoạt động');
    }
    if (months === undefined) {
      // Admin can also grant a package currently hidden from public sale.
      const plan = await PremiumPlanModel.findOne({ code: input.planCode }).lean();
      if (!plan) throw new AppError(404, 'PLAN_UNAVAILABLE', 'Không tìm thấy gói');
      months = plan.durationMonths;
    }
    const expiresAt = addMonths(user.premiumExpiresAt && user.premiumExpiresAt > now ? user.premiumExpiresAt : now, months);
    const grant = { grantId: input.idempotencyKey, grantedBy: adminId, planCode: input.planCode,
      durationMonths: months, reason: input.reason, grantedAt: now, expiresAt };
    const updated = await UserModel.updateOne({
      _id: userId, role: 'user', status: 'active', premiumExpiresAt: user.premiumExpiresAt ?? null,
      'premiumReceipts.grantId': { $ne: input.idempotencyKey },
    }, { $set: { premiumExpiresAt: expiresAt }, $push: { premiumReceipts: grant } });
    if (updated.modifiedCount === 1) return { userId, premiumExpiresAt: expiresAt, grant, replayed: false };
  }
  throw new AppError(503, 'PREMIUM_RETRY_REQUIRED', 'Đang cập nhật gói. Vui lòng thử lại yêu cầu này.');
}
