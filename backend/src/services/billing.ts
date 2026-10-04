import { randomInt } from 'node:crypto';
import { NotFoundError } from '@payos/node';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { getPayOS } from './payos.js';
import { grantPremium } from './premium.js';
import { logger } from './logger.js';

type Order = NonNullable<Awaited<ReturnType<typeof PaymentOrderModel.findOne>>>;

export function publicOrder(order: Order) {
  const isPayable = ['CREATING', 'PENDING', 'UNDERPAID', 'PROCESSING'].includes(order.status);
  const o = order as unknown as Record<string, unknown>;
  return {
    orderCode: order.orderCode, planCode: order.planCode, planName: order.planName,
    durationMonths: order.durationMonths, amount: order.amount, currency: order.currency,
    status: order.status, checkoutUrl: isPayable ? order.checkoutUrl ?? null : null,
    qrCode: isPayable ? (typeof o.qrCode === 'string' ? o.qrCode : null) : null,
    bin: isPayable ? (typeof o.bin === 'string' ? o.bin : null) : null,
    accountNumber: isPayable ? (typeof o.accountNumber === 'string' ? o.accountNumber : null) : null,
    accountName: isPayable ? (typeof o.accountName === 'string' ? o.accountName : null) : null,
    description: isPayable ? (typeof o.description === 'string' ? o.description : null) : null,
    expiresAt: order.expiresAt, paidAt: order.paidAt ?? null,
    premiumExpiresAt: order.premiumExpiresAt ?? null, createdAt: order.createdAt,
  };
}

export async function ownedOrder(userId: Types.ObjectId, orderCode: number) {
  const order = await PaymentOrderModel.findOne({ userId, orderCode });
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn thanh toán');
  return order;
}

export async function createCheckout(userId: Types.ObjectId, input: { planCode: 'monthly' | 'quarterly' | 'yearly'; expectedPrice: number; idempotencyKey: string }) {
  let order = await PaymentOrderModel.findOne({ userId, idempotencyKey: input.idempotencyKey });
  if (!order) {
    getPayOS(); // Fail before inserting an order if payment is not configured.
    const plan = await PremiumPlanModel.findOne({ code: input.planCode, active: true }).lean();
    if (!plan) throw new AppError(404, 'PLAN_UNAVAILABLE', 'Gói này hiện không được mở bán');
    if (plan.price !== input.expectedPrice) throw new AppError(409, 'PLAN_PRICE_CHANGED', 'Giá gói đã thay đổi. Vui lòng tải lại bảng giá.', { price: plan.price });
    try {
      order = await PaymentOrderModel.create({
        userId, idempotencyKey: input.idempotencyKey,
        // Below Number.MAX_SAFE_INTEGER, cryptographic randomness + unique index.
        orderCode: randomInt(1_000_000_000, 281_474_976_710_655),
        planCode: plan.code, planName: plan.name, planRevision: plan.revision,
        durationMonths: plan.durationMonths, amount: plan.price,
        expiresAt: new Date(Date.now() + env.PAYOS_LINK_TTL_MINUTES * 60_000),
      });
      logger.info({ userId: String(userId), orderCode: order.orderCode }, 'PREMIUM_PAYMENT_CREATED');
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      order = await PaymentOrderModel.findOne({ userId, idempotencyKey: input.idempotencyKey });
      if (!order) throw new AppError(503, 'CHECKOUT_RETRY_REQUIRED', 'Vui lòng thử lại yêu cầu thanh toán');
    }
  }
  if (order.planCode !== input.planCode || order.amount !== input.expectedPrice) {
    throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đã được dùng cho một đơn khác');
  }
  if (order.status !== 'CREATING') return publicOrder(order);
  if (order.expiresAt <= new Date()) {
    // Query the provider before marking expired: an earlier create could have
    // timed out locally while still creating a payable link at payOS.
    return publicOrder(await reconcileOrder(order));
  }
  const returnUrl = new URL(env.PAYOS_RETURN_URL || '/premium/payment', env.APP_PUBLIC_URL);
  const cancelUrl = new URL(env.PAYOS_CANCEL_URL || '/premium/payment', env.APP_PUBLIC_URL);
  returnUrl.searchParams.set('orderCode', String(order.orderCode));
  cancelUrl.searchParams.set('orderCode', String(order.orderCode));
  cancelUrl.searchParams.set('cancel', 'true');
  try {
    const link = await getPayOS().paymentRequests.create({
      orderCode: order.orderCode, amount: order.amount, description: `HF ${order.orderCode}`,
      items: [{ name: `HanFlix Premium ${order.durationMonths} thang`, price: order.amount, quantity: 1 }],
      returnUrl: returnUrl.toString(), cancelUrl: cancelUrl.toString(),
      expiredAt: Math.floor(order.expiresAt.getTime() / 1000),
    });
    if (link.orderCode !== order.orderCode || link.amount !== order.amount || link.currency !== 'VND') {
      throw new AppError(502, 'PAYMENT_MISMATCH', 'Thông tin thanh toán không khớp');
    }
    await PaymentOrderModel.updateOne({ _id: order._id, status: 'CREATING' }, {
      $set: {
        paymentLinkId: link.paymentLinkId,
        checkoutUrl: link.checkoutUrl,
        qrCode: link.qrCode,
        bin: link.bin,
        accountNumber: link.accountNumber,
        accountName: link.accountName,
        description: link.description,
        status: 'PENDING',
      },
    });
    return publicOrder(await ownedOrder(userId, order.orderCode));
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Retry with the same merchant order code: recover a successful provider
    // creation whose response was lost, instead of creating another charge.
    try { return publicOrder(await reconcileOrder(order)); }
    catch (reconcileError) {
      if (reconcileError instanceof AppError && reconcileError.code === 'PAYMENT_MISMATCH') throw reconcileError;
      throw new AppError(502, 'PAYOS_UNAVAILABLE', 'Chưa kết nối được payOS. Thử lại với cùng Idempotency-Key.');
    }
  }
}

export async function reconcileOrder(order: Order) {
  if (order.status === 'PAID') return order;
  let link;
  try { link = await getPayOS().paymentRequests.get(order.orderCode); }
  catch (error) {
    if (error instanceof NotFoundError && order.status === 'CREATING' && order.expiresAt <= new Date()) {
      await PaymentOrderModel.updateOne({ _id: order._id, status: 'CREATING' }, { $set: { status: 'EXPIRED' } });
      return ownedOrder(order.userId, order.orderCode);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'PAYOS_UNAVAILABLE', 'Chưa kiểm tra được thanh toán. Vui lòng thử lại, không cần chuyển khoản lần nữa.');
  }
  if (link.orderCode !== order.orderCode || link.amount !== order.amount || typeof link.id !== 'string' || !link.id
    || (order.paymentLinkId && link.id !== order.paymentLinkId)) {
    throw new AppError(502, 'PAYMENT_MISMATCH', 'Thông tin thanh toán không khớp');
  }
  if (link.status === 'PAID') {
    if (!Number.isSafeInteger(link.amountPaid) || !Number.isSafeInteger(link.amountRemaining)
      || link.amountPaid < order.amount || link.amountRemaining > 0) throw new AppError(502, 'PAYMENT_MISMATCH', 'Thanh toán chưa đủ số tiền');
    const premiumExpiresAt = await grantPremium(order.userId, order.orderCode, order.durationMonths, new Date(), order.planCode);
    await PaymentOrderModel.updateOne({ _id: order._id, status: { $ne: 'PAID' } }, {
      $set: { status: 'PAID', paidAt: new Date(), premiumExpiresAt, paymentLinkId: link.id },
    });
  } else {
    if (!['PENDING', 'UNDERPAID', 'PROCESSING', 'CANCELLED', 'EXPIRED'].includes(link.status)) {
      throw new AppError(502, 'PAYMENT_MISMATCH', 'Trạng thái thanh toán không hợp lệ');
    }
    // Terminal states cannot be downgraded by an older in-flight lookup.
    // A later verified PAID can still recover a delayed payment notification.
    await PaymentOrderModel.updateOne({ _id: order._id, status: { $in: ['CREATING', 'PENDING', 'UNDERPAID', 'PROCESSING'] } }, {
      $set: { status: link.status, paymentLinkId: link.id, checkoutUrl: `https://pay.payos.vn/web/${encodeURIComponent(link.id)}` },
    });
  }
  return ownedOrder(order.userId, order.orderCode);
}

export async function handlePayOSWebhook(body: Parameters<ReturnType<typeof getPayOS>['webhooks']['verify']>[0]) {
  const payos = getPayOS();
  let data;
  try { data = await payos.webhooks.verify(body); }
  catch { throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Chữ ký webhook không hợp lệ'); }
  if (data.code !== '00') return;
  const order = await PaymentOrderModel.findOne({ orderCode: data.orderCode });
  // payOS registration sends a signed sample. Never create an order from it.
  if (!order) return;
  if (data.currency !== 'VND' || (order.paymentLinkId && data.paymentLinkId !== order.paymentLinkId)) {
    throw new AppError(400, 'PAYMENT_MISMATCH', 'Webhook không khớp đơn thanh toán');
  }
  // The webhook may describe one partial transfer. Query the provider's total
  // and signed status; only the fully paid order can grant an entitlement.
  await reconcileOrder(order);
}
