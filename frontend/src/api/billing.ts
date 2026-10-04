import { apiFetch } from "./client"

import { newBillingRequestKey } from "../lib/billing-session"

export interface PremiumPlan {
  code: "monthly" | "quarterly" | "yearly"

  name: string

  durationMonths: number

  price: number

  currency: string

  active?: boolean | null

  revision?: number | null

  updatedAt?: string | null

  pricePerMonth: number

  approximatePricePerDay: number

  savings: number

  savingsPercent: number

  highlighted: boolean

  badge: string | null
}

export interface BillingPlansData {
  title: string

  subtitle: string

  description: string

  benefits: string[]

  plans: PremiumPlan[]

  freeSampleLessonIds: string[]

  paymentAvailable: boolean
}

export interface UserSubscription {
  tier: "premium" | "free"

  premiumExpiresAt: string | null

  benefits: string[]

  status?: "FREE" | "TRIAL" | "ACTIVE" | "EXPIRED"

  trialEligible?: boolean

  hasUsedPremiumTrial?: boolean

  hasPremiumAccess?: boolean

  showWelcomeTrialPopup?: boolean

  planCode?: "monthly" | "quarterly" | "yearly" | string | null

  trial?: {
    startedAt: string
    endsAt: string
    remainingSeconds: number
    remainingDays?: number
    planCode?: string
  } | null

  premium?: {
    startedAt: string | null
    endsAt: string | null
    planCode?: string | null
  }
}

export function markTrialWelcomeSeen(signal?: AbortSignal) {
  return apiFetch<{ success: boolean }>("/auth/trial-welcome/seen", {
    method: "POST",

    signal,
  })
}

export type PremiumRegistration = {
  type: "PAYMENT_REQUIRED"
  order: PaymentOrder
}

export function subscribePremium(
  planCode: PremiumPlan["code"],
  idempotencyKey: string,
  signal?: AbortSignal,
  expectedPrice?: number,
) {
  return apiFetch<PremiumRegistration>("/billing/subscribe", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },

    body: JSON.stringify({ planCode, expectedPrice }),
    signal,
  })
}

export interface PaymentOrder {
  orderCode: number

  planCode: "monthly" | "quarterly" | "yearly"

  planName: string

  durationMonths: number

  amount: number

  currency: string

  status: "CREATING" | "PENDING" | "UNDERPAID" | "PROCESSING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED"

  checkoutUrl: string | null

  qrCode?: string | null

  bin?: string | null

  accountNumber?: string | null

  accountName?: string | null

  description?: string | null

  expiresAt: string

  paidAt: string | null

  premiumExpiresAt: string | null

  createdAt: string

  userId?: string
}

export interface CreateCheckoutInput {
  planCode: "monthly" | "quarterly" | "yearly"

  expectedPrice: number
}

export interface PaginatedOrders {
  items: PaymentOrder[]

  page: number

  limit: number

  total: number
}

export type OrderStatusFilter = "ALL" | "PAID" | "PENDING" | "OTHER"

export interface UserOrdersData extends PaginatedOrders {
  summary: {
    totalOrders: number

    paidOrders: number

    pendingOrders: number

    otherOrders: number

    totalSpent: number
  }
}

export interface AdminPlansData {
  items: PremiumPlan[]

  paymentAvailable: boolean
}

export interface AdminPatchPlanInput {
  price?: number

  name?: string

  active?: boolean

  revision: number
}

/** Lấy danh sách gói cước và quyền lợi Premium */

export async function getBillingPlans(
  signal?: AbortSignal,
): Promise<BillingPlansData> {
  return apiFetch<BillingPlansData>("/billing/plans", { signal })
}

/** Kiểm tra gói cước hiện tại của học viên */

export async function getUserSubscription(
  signal?: AbortSignal,
): Promise<UserSubscription> {
  return apiFetch<UserSubscription>("/billing/subscription", { signal })
}

/** Tạo đơn hàng thanh toán PayOS */

export async function createCheckout(
  input: CreateCheckoutInput,

  idempotencyKey?: string,

  signal?: AbortSignal,
): Promise<PaymentOrder> {
  const key = idempotencyKey || newBillingRequestKey()

  return apiFetch<PaymentOrder>("/billing/checkout", {
    method: "POST",

    headers: {
      "Idempotency-Key": key,
    },

    body: JSON.stringify(input),

    signal,
  })
}

/** Lấy lịch sử đơn hàng của học viên */

export async function getUserOrders(
  params?: {
    page?: number
    limit?: number
    status?: OrderStatusFilter
    search?: string
  },

  signal?: AbortSignal,
): Promise<UserOrdersData> {
  const query = new URLSearchParams()

  if (params?.page) query.set("page", String(params.page))

  if (params?.limit) query.set("limit", String(params.limit))

  if (params?.status) query.set("status", params.status)

  if (params?.search) query.set("search", params.search)

  const queryString = query.toString() ? `?${query.toString()}` : ""

  return apiFetch<UserOrdersData>(`/billing/orders${queryString}`, { signal })
}

/** Tra cứu chi tiết & đối soát đơn hàng PayOS */

export async function getOrderDetails(
  orderCode: number,
  signal?: AbortSignal,
): Promise<PaymentOrder> {
  return apiFetch<PaymentOrder>(`/billing/orders/${orderCode}`, { signal })
}

/** Hủy đơn hàng thanh toán */

export async function cancelOrder(
  orderCode: number,
  signal?: AbortSignal,
): Promise<PaymentOrder> {
  return apiFetch<PaymentOrder>(`/billing/orders/${orderCode}/cancel`, {
    method: "POST",

    signal,
  })
}

/** [ADMIN] Lấy toàn bộ danh sách gói cước */

export async function getAdminBillingPlans(
  signal?: AbortSignal,
): Promise<AdminPlansData> {
  return apiFetch<AdminPlansData>("/admin/billing/plans", { signal })
}

/** [ADMIN] Khôi phục 3 gói cước mặc định chuẩn ban đầu */

export async function resetAdminBillingPlans(
  signal?: AbortSignal,
): Promise<AdminPlansData> {
  return apiFetch<AdminPlansData>("/admin/billing/plans/reset-defaults", {
    method: "POST",

    signal,
  })
}

/** [ADMIN] Chỉnh sửa giá gói / tên / trạng thái */

export async function patchAdminBillingPlan(
  code: string,

  data: AdminPatchPlanInput,

  signal?: AbortSignal,
): Promise<PremiumPlan> {
  return apiFetch<PremiumPlan>(`/admin/billing/plans/${code}`, {
    method: "PATCH",

    body: JSON.stringify(data),

    signal,
  })
}

/** [ADMIN] Lấy toàn bộ danh sách đơn hàng toàn hệ thống */

export async function getAdminBillingOrders(
  params?: { page?: number; limit?: number },

  signal?: AbortSignal,
): Promise<PaginatedOrders> {
  const query = new URLSearchParams()

  if (params?.page) query.set("page", String(params.page))

  if (params?.limit) query.set("limit", String(params.limit))

  const queryString = query.toString() ? `?${query.toString()}` : ""

  return apiFetch<PaginatedOrders>(`/admin/billing/orders${queryString}`, {
    signal,
  })
}

export interface PremiumGrant {
  grantId: string

  grantedBy: string

  planCode: PremiumPlan["code"]

  durationMonths: number

  reason: string

  grantedAt: string

  expiresAt: string
}

export function activateAdminUserPremium(
  userId: string,
  input: { planCode: PremiumPlan["code"]; reason: string },
  idempotencyKey: string,
) {
  return apiFetch<{
    userId: string
    premiumExpiresAt: string
    grant: PremiumGrant
    replayed: boolean
  }>(`/admin/billing/users/${encodeURIComponent(userId)}/activate`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  })
}

export function getAdminUserGrants(userId: string, signal?: AbortSignal) {
  return apiFetch<{ premiumExpiresAt: string | null; items: PremiumGrant[] }>(
    `/admin/billing/users/${encodeURIComponent(userId)}/grants`,
    { signal },
  )
}
