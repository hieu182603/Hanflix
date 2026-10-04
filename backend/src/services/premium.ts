import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { nextPremiumStart, paidPeriodStart } from './premium-access.js';
import { logger } from './logger.js';
export { hasPremium } from './premium-access.js';

export const PREMIUM_BENEFITS = [
  'Xem video học không giới hạn',
  'Phụ đề Chữ Hán – Pinyin – Tiếng Việt',
  'Tra cứu và lưu từ vựng trực tiếp trong video',
  'Mở khóa toàn bộ quiz/bài luyện tập',
  'AI cá nhân hóa & đề xuất nội dung',
  'Theo dõi tiến độ học tập',
  'Kho từ vựng & Flashcard',
  'Kho ngữ pháp',
];

export const DEFAULT_BILLING_PLANS = [
  { code: 'monthly', name: '1 tháng – Cơ bản', durationMonths: 1, price: 99000, active: true },
  { code: 'quarterly', name: '3 tháng – Được yêu thích nhất', durationMonths: 3, price: 249000, active: true },
  { code: 'yearly', name: '1 năm – Tiết kiệm', durationMonths: 12, price: 699000, active: true },
] as const;

export async function initializeBilling(forceReset = false) {
  // Unique indexes are required before accepting checkout requests.
  await Promise.all([PremiumPlanModel.createIndexes(), PaymentOrderModel.createIndexes()]);
  for (const plan of DEFAULT_BILLING_PLANS) {
    try {
      if (forceReset) {
        await PremiumPlanModel.updateOne(
          { code: plan.code },
          { $set: { ...plan }, $inc: { revision: 1 } },
          { upsert: true }
        );
      } else {
        await PremiumPlanModel.updateOne(
          { code: plan.code },
          { $setOnInsert: { ...plan, revision: 1 } },
          { upsert: true }
        );
      }
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
}

export function premiumRequired(code: 'PREMIUM_REQUIRED' | 'TRIAL_EXPIRED' = 'PREMIUM_REQUIRED') {
  return new AppError(403, code, 'Nâng cấp HanFlix Premium để mở khóa nội dung này', { upgradePath: '/premium' });
}

export async function freeSampleIds(hsk?: number): Promise<string[]> {
  const lessons = await LessonModel.find({ status: 'published', contentMode: { $ne: 'podcast' }, ...(hsk ? { hsk } : {}) })
    .sort({ _id: 1 }).limit(5).select('_id').lean();
  return lessons.map(lesson => String(lesson._id));
}

// Calendar months, clamped at month-end; preserve time of day in UTC.
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function grantPremium(userId: Types.ObjectId, orderCode: number, months: number, now = new Date(), planCode?: string) {
  // Receipt + entitlement are one atomic user-document update. A retry after
  // a crash between this write and marking the order PAID cannot double-grant.
  // Compare-and-swap also prevents two different orders losing an extension.
  for (let attempt = 0; attempt < 10; attempt++) {
    const user = await UserModel.findById(userId).select('premiumExpiresAt premiumStartedAt premiumTrial +premiumReceipts').lean();
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản thanh toán');
    const receipt = user.premiumReceipts?.find(item => item.orderCode === orderCode);
    if (receipt) return receipt.expiresAt;
    const startedAt = nextPremiumStart(user, now);
    const expiresAt = addMonths(startedAt, months);
    const result = await UserModel.updateOne({
      _id: userId,
      premiumExpiresAt: user.premiumExpiresAt ?? null,
      'premiumTrial.endsAt': user.premiumTrial?.endsAt ?? null,
      'premiumReceipts.orderCode': { $ne: orderCode },
    }, {
      $set: { premiumExpiresAt: expiresAt, premiumStartedAt: paidPeriodStart(user, startedAt, now), hasEverPurchasedPremium: true,
        ...(planCode ? { premiumPlanCode: planCode } : {}) },
      $push: { premiumReceipts: { orderCode, expiresAt, grantedAt: now, planCode, durationMonths: months } },
    });
    if (result.modifiedCount === 1) {
      logger.info({ userId: String(userId), orderCode }, 'PREMIUM_ACTIVATED');
      return expiresAt;
    }
  }
  throw new AppError(503, 'PAYMENT_RETRY_REQUIRED', 'Đang cập nhật gói. Vui lòng kiểm tra lại thanh toán.');
}

export function presentPlan(
  plan: {
    code: string;
    name: string;
    durationMonths: number;
    price: number;
    active?: boolean | null;
    revision?: number | null;
    updatedAt?: Date | string | null;
  },
  monthlyPrice: number
) {
  const savings = Math.max(0, monthlyPrice * plan.durationMonths - plan.price);
  return {
    code: plan.code,
    name: plan.name,
    durationMonths: plan.durationMonths,
    price: plan.price,
    currency: 'VND',
    active: plan.active,
    revision: plan.revision,
    updatedAt: plan.updatedAt ? new Date(plan.updatedAt).toISOString() : null,
    pricePerMonth: Math.round(plan.price / plan.durationMonths),
    approximatePricePerDay: Math.round(plan.price / (plan.durationMonths * 30)),
    savings,
    savingsPercent: monthlyPrice > 0 ? Math.round(savings / (monthlyPrice * plan.durationMonths) * 100) : 0,
    highlighted: plan.code === 'quarterly',
    badge: plan.code === 'quarterly' ? 'Được yêu thích nhất' : null,
  };
}
