import { useI18n } from '../../i18n';
import React, { useEffect, useState } from 'react';
import {
  Check,
  Crown,
  ShieldCheck,
  Zap,
  Award,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getBillingPlans,
  getUserSubscription,
  type PremiumPlan,
} from '../../api/billing';
import PayOSCheckoutModal from './PayOSCheckoutModal';

interface PremiumPricingPageProps {
  currentUser?: {
    name?: string;
    email?: string;
    role?: string;
    premiumExpiresAt?: Date | string | null;
  } | null;
  onNavigateLessons?: () => void;
}

export default function PremiumPricingPage({
  currentUser,
  onNavigateLessons
}: PremiumPricingPageProps) {
  const { tr, ui, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [planNotice, setPlanNotice] = useState('');

  // Lấy dữ liệu gói cước từ API
  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: ({ signal }) => getBillingPlans(signal),
    staleTime: 60000,
  });
  useEffect(() => {
    const changed = () => {
      setIsCheckoutOpen(false);
      setSelectedPlan(null);
      setPlanNotice('Gói hoặc giá vừa thay đổi. Hãy kiểm tra bảng giá mới và chọn lại gói phù hợp.');
      void queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
    };
    window.addEventListener('hanflix:billing-plans-updated', changed);
    return () => window.removeEventListener('hanflix:billing-plans-updated', changed);
  }, [queryClient]);

  // Lấy trạng thái subscription của người dùng
  const subscriptionQuery = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: ({ signal }) => getUserSubscription(signal),
    staleTime: 30000,
    enabled: Boolean(currentUser),
  });

  const isUserPremium = currentUser?.role === 'admin' || (subscriptionQuery.data
    ? subscriptionQuery.data.tier === 'premium'
    : Boolean(currentUser?.premiumExpiresAt && new Date(currentUser.premiumExpiresAt) > new Date()));
  const plans = plansQuery.data?.plans || [];
  const canPay = plansQuery.data?.paymentAvailable === true;
  const navigate = useNavigate();

  const handleSelectPlan = (plan: PremiumPlan) => {
    if (!currentUser) {
      navigate('/auth/login', { state: { returnTo: '/premium' } });
      return;
    }
    if (!canPay) return;
    setPlanNotice('');
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
  };
  const plan1Month = plans.find(p => p.code === 'monthly');
  const plan3Months = plans.find(p => p.code === 'quarterly');
  const plan1Year = plans.find(p => p.code === 'yearly');
  const money = (amount: number) => amount.toLocaleString(locale);


  if (plansQuery.isPending) return <div role="status" className="p-8 text-center">{tr("Đang tải bảng giá…")}</div>;
  if (plansQuery.isError) return <div role="alert" className="p-8 space-y-3 text-center"><p>{tr("Chưa tải được bảng giá hiện tại.")}</p><button type="button" onClick={() => void plansQuery.refetch()} className="underline">{tr("Thử lại")}</button></div>;

  return (
    <div className="w-full text-[#18181B] space-y-12">
      {planNotice && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{ui(planNotice)}</p>}
      {/* Banner trạng thái nếu đã có VIP */}
      {isUserPremium && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-300/80 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md">
              <Crown className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-neutral-900 tracking-tight">{tr("Tài khoản HanFlix Premium đang hoạt động")}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                  VIP
                </span>
              </div>
              <p className="text-xs text-[#5F6368] mt-0.5">{tr("Thời hạn gói của bạn:")} {(subscriptionQuery.data?.premiumExpiresAt ?? currentUser?.premiumExpiresAt) ? new Date((subscriptionQuery.data?.premiumExpiresAt ?? currentUser?.premiumExpiresAt)!).toLocaleDateString(locale) : tr("Đang hoạt động")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateLessons && (
              <button
                type="button"
                onClick={onNavigateLessons}
                className="px-4 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all cursor-pointer"
              >{tr("Học ngay")}</button>
            )}
          </div>
        </div>
      )}



      <header className="space-y-3 text-center">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{tr("Nâng cấp HanFlix Premium")}</h1>
        <p className="text-[#5F6368]">{tr("Học tiếng Trung trọn vẹn hơn qua mỗi câu chuyện.")}</p>
        <p className="text-sm text-[#5F6368]">{tr("Video được giới hạn theo HSK hiện tại trong hồ sơ, áp dụng cho cả Free và Premium.")}</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-4 space-y-5">
          <h2 className="text-xl font-black">{tr("Quyền lợi HanFlix Premium")}</h2>
          <ul className="space-y-4">
            {(plansQuery.data?.benefits ?? []).map(benefit => <li key={benefit} className="flex gap-3 text-sm">
              <Check className="h-5 w-5 shrink-0 text-emerald-700" />{ui(benefit)}
            </li>)}
          </ul>
          <p className="rounded-2xl border border-[#E7E7EA] bg-white p-4 text-sm leading-relaxed text-[#5F6368]">
            {tr("Free: xem 5 video mẫu, phụ đề Chữ Hán – Pinyin – Tiếng Việt và tra cứu từ vựng cơ bản.")}
          </p>
        </section>
        <section className="lg:col-span-8 space-y-6" aria-label={tr("Các gói Premium")}>
          <p className="text-sm text-[#5F6368]">{tr("Cả 3 gói đều mở khóa toàn bộ quyền lợi Premium, chỉ khác nhau về giá và thời hạn.")}</p>
          {!canPay && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{tr("Thanh toán đang tạm ngưng. Vui lòng quay lại sau.")}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch pt-3">
            {[plan1Month, plan3Months, plan1Year].filter((plan): plan is PremiumPlan => Boolean(plan)).map(plan => {
              const highlighted = plan.code === 'quarterly';
              return <article key={plan.code} aria-label={ui(plan.name)} data-plan={plan.code}
                className={`relative rounded-3xl border-2 p-5 flex flex-col gap-5 ${highlighted ? 'border-[#B91B1C] bg-[#FFF2EE] shadow-lg' : 'border-[#E7E7EA] bg-white'}`}>
                {highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#B91B1C] px-3 py-1 text-[11px] font-bold text-white">⭐ {tr("Được yêu thích nhất")}</span>}
                <div className="pt-2 space-y-2">
                  <h3 className="text-xl font-black">{tr(plan.code === 'monthly' ? '1 tháng' : plan.code === 'quarterly' ? '3 tháng' : '1 năm')}</h3>
                  <p className="text-sm font-semibold text-[#5F6368]">{tr(plan.code === 'monthly' ? 'Cơ bản' : plan.code === 'quarterly' ? 'Được yêu thích nhất' : 'Tiết kiệm')}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-black">{money(plan.price)} {tr("đ")}</p>
                  <p className="text-sm text-[#5F6368]">{plan.code === 'monthly' ? <>{tr("Khoảng")} {money(plan.approximatePricePerDay)} {tr("đ/ngày")}</> : <>{money(plan.pricePerMonth)} {tr("đ/tháng")}</>}</p>
                  {plan.savings > 0 && <p className="text-sm font-semibold text-emerald-700">{tr("Tiết kiệm")} {money(plan.savings)} {tr("đ")} (~{plan.savingsPercent}%)</p>}
                </div>
                <p className="text-sm flex gap-2"><Check className="w-4 h-4 shrink-0 text-emerald-700" />{tr("Toàn bộ quyền lợi Premium")}</p>
                <button type="button" disabled={!canPay} onClick={() => handleSelectPlan(plan)}
                  className={`mt-auto w-full rounded-xl px-3 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${highlighted ? 'bg-[#B91B1C] text-white hover:bg-[#A3181A]' : 'bg-[#F7F7F9] text-[#18181B] hover:bg-[#FFE6DF]'}`}>
                  {tr(isUserPremium ? "Gia hạn ngay" : "Nâng cấp ngay")}
                </button>
              </article>;
            })}
          </div>
        </section>
      </div>

      {/* ===============================================================
          BẢNG SO SÁNH TÍNH NĂNG CHI TIẾT (FEATURE COMPARISON MATRIX)
      =============================================================== */}
      <div className="pt-6 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-[#18181B] tracking-tight">{tr("So sánh chi tiết tính năng từng gói")}</h2>
          <p className="text-xs sm:text-sm text-[#5F6368]">{tr("Đối chiếu rõ ràng quyền lợi giữa tài khoản Miễn phí và các gói HanFlix Premium")}</p>
        </div>

        <div className="rounded-3xl bg-white border border-[#E7E7EA] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAF7F5] border-b border-[#E7E7EA] text-[#18181B]">
                  <th className="py-4 px-4 sm:px-6 font-black text-sm w-2/5">{tr("Tính năng & Quyền lợi")}</th>
                  <th className="py-4 px-3 text-center font-bold text-neutral-600">{tr("Miễn phí")}</th>
                  <th className="py-4 px-3 text-center font-bold text-neutral-800">{tr("1 Tháng")}</th>
                  <th className="py-4 px-3 text-center font-black text-[#B91B1C] bg-red-50/50">{tr("3 Tháng")}</th>
                  <th className="py-4 px-3 text-center font-bold text-neutral-800">{tr("1 Năm")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2E4D8]/40">
                {(plansQuery.data?.benefits ?? []).map((benefit, index) => <tr key={benefit}>
                  <td className="py-3.5 px-4 sm:px-6 font-semibold">{ui(benefit)}</td>
                  <td className="py-3.5 px-3 text-center">{index === 0 ? tr("5 video mẫu") : index === 1 ? tr("Video mẫu") : index === 2 ? tr("Tra cứu cơ bản") : tr("Cần Premium")}</td>
                  {[1, 3, 12].map(months => <td key={months} className="py-3.5 px-3 text-center text-emerald-700">{tr("Có")}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===============================================================
          CAM KẾT AN TOÀN & FAQ
      =============================================================== */}
      <div className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs text-[#5F6368] border-t border-[#F2E4D8]/80">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-[#18181B]">{tr("Thanh toán qua cổng VietQR payOS")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-[#18181B]">{tr("Kích hoạt sau khi xác nhận đủ tiền")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-[#18181B]">{tr("Không phát sinh chi phí ẩn hay tự động trừ tiền")}</span>
        </div>
      </div>




      {/* PayOS Checkout Modal */}
      {selectedPlan && (
        <PayOSCheckoutModal
          plan={selectedPlan}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries();
          }}
        />
      )}
    </div>
  );
}
