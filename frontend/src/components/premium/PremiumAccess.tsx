import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';

const PremiumContext = createContext(false);
const LearnerHskContext = createContext<{ hsk: number | null; isLearner: boolean }>({ hsk: null, isLearner: false });

export function PremiumAccessProvider({ user, children }: {
  user: { role?: string; premiumExpiresAt?: string | Date | null; learningProfile?: { hskLevel?: number } | null } | null;
  children: ReactNode;
}) {
  const { tr } = useI18n();
  const location = useLocation();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const show = () => setShowUpgrade(true);
    window.addEventListener('hanflix:premium-required', show);
    return () => window.removeEventListener('hanflix:premium-required', show);
  }, []);
  useEffect(() => setShowUpgrade(false), [location.pathname]);
  const expiry = user?.premiumExpiresAt ? new Date(user.premiumExpiresAt).getTime() : 0;
  useEffect(() => {
    // Close premium views at expiry even if the tab loses its connection.
    const delay = expiry - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(delay + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [expiry, now]);
  const allowed = user?.role === 'admin' || expiry > Math.max(now, Date.now());
  const level = user?.learningProfile?.hskLevel;
  const hsk = Number.isInteger(level) && level! >= 1 && level! <= 9 ? level! : null;
  return <LearnerHskContext.Provider value={{ hsk, isLearner: Boolean(user && user.role !== 'admin') }}><PremiumContext.Provider value={allowed}>{children}
    {showUpgrade && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={tr('Nâng cấp HanFlix Premium')}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-4 space-y-3">
        <button type="button" autoFocus onClick={() => setShowUpgrade(false)} className="p-2 font-bold">{tr('Đóng')}</button>
        <PremiumNotice />
      </div>
    </div>}
  </PremiumContext.Provider></LearnerHskContext.Provider>;
}

export function usePremiumAccess() { return useContext(PremiumContext); }
export function useLearnerHsk() { return useContext(LearnerHskContext); }
export function requestPremiumUpgrade() { window.dispatchEvent(new Event('hanflix:premium-required')); }

export function PremiumNotice() {
  const { tr } = useI18n();
  return <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8 space-y-4" aria-label={tr('Nội dung HanFlix Premium')}>
    <h2 className="text-xl font-black text-[#18181B]">{tr('Nâng cấp HanFlix Premium')}</h2>
    <p className="text-sm text-[#5F6368]">{tr('Nâng cấp HanFlix Premium để mở khóa nội dung này')}</p>
    <p className="text-sm text-[#5F6368]">{tr('Free: xem 5 video mẫu, phụ đề Chữ Hán – Pinyin – Tiếng Việt và tra cứu từ vựng cơ bản.')}</p>
    <Link to="/premium" className="inline-flex rounded-xl bg-[#B91B1C] px-5 py-3 text-sm font-bold text-white">{tr('Nâng cấp ngay')}</Link>
  </section>;
}

export function PremiumGate({ children }: { children: ReactNode }) {
  return usePremiumAccess() ? <>{children}</> : <PremiumNotice />;
}
