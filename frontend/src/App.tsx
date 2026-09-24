import React, { useState, useEffect, lazy } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { useLanguage } from './i18n';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import PreferencesDrawer from './components/PreferencesDrawer';
import LandingPage from './components/LandingPage';
import { ExamPrepPage, LeaderboardPage, CommunityPage } from './components/ExamPrepPage';
import GrammarPage from './components/grammar/GrammarPage';

// Settings & Survey Modals
import SettingsModal from './components/settings/SettingsModal';
import LearningSurveyModal from './components/onboarding/LearningSurveyModal';
import StreakCelebrationToast from './components/streak/StreakCelebrationToast';
import XpCelebrationToast from './components/xp/XpCelebrationToast';
import { getStreakState } from './lib/streak';

// Watch Views
const PublishedLessonView = lazy(() => import('./components/watch/PublishedLessonView'));
const WatchView = lazy(() => import('./components/watch/WatchView'));

// Admin area: lazy as a whole — admin users are a minority and the shell
// itself imports heavy editor / table components we don't want in the
// first paint of regular learner traffic.
const AdminShell = lazy(() => import('./components/admin/AdminShell'));
const ConnectedAdmin = lazy(() => import('./components/admin/ConnectedAdmin'));
const AdminVocabularyManager = lazy(() => import('./components/admin/AdminVocabularyManager'));
const AdminGrammarManager = lazy(() => import('./components/admin/AdminGrammarManager'));
const AdminQuizManager = lazy(() => import('./components/admin/AdminQuizManager'));
const AdminUserManager = lazy(() => import('./components/admin/AdminUserManager'));

// Auth, Vocabulary & Review — login/signup/forgot/verify/reset stay eager
// because they are the first screens after the marketing landing page.
import LoginView from './components/auth/LoginView';
import SignupView from './components/auth/SignupView';
import OnboardingView from './components/auth/OnboardingView';
import ForgotPasswordView from './components/auth/ForgotPasswordView';
import VerifyEmailView from './components/auth/VerifyEmailView';
import ResetPasswordView from './components/auth/ResetPasswordView';

// API auth
import * as authApi from './api/auth';
import ConnectedLearner from './components/ConnectedLearner';
import { PandaPet } from './components/panda-pet';
import NotFoundPage from './components/NotFoundPage';
import HanFlixLoadingScreen from './components/HanFlixLoadingScreen';
import { LazyRouteBoundary } from './components/LazyRouteBoundary';
import { perfMarks } from './lib/perfMarks';

import {
  VideoLesson,
  User,
  UserProfile,
  SAMPLE_LESSONS,
  UserLearningProfile,
} from './data/hanflixData';
import {
  Home, PlaySquare, BookMarked, BookOpenCheck, Map
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

function VideoToWatchRedirect() {
  const { lessonId } = useParams<{ lessonId: string }>();
  return <Navigate to={lessonId ? `/watch/${lessonId}` : '/lessons'} replace />;
}

type AuthView = 'login' | 'signup' | 'onboarding' | 'forgot-password' | 'verify-email' | 'reset-password';

const NAV_SECTIONS = ['feed', 'lessons', 'saved', 'vocabulary', 'roadmap', 'history', 'exam', 'leaderboard', 'grammar', 'settings', 'profile'] as const;
type NavSection = typeof NAV_SECTIONS[number];

// Map URL pathname → activeNav id (for learner pages).
// Matches exact routes from <Routes> in AppRoutes. Falls back to last nav in localStorage.
function pathToActiveNav(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return 'feed';
  if (pathname.startsWith('/saved')) return 'vocabulary';
  const seg = pathname.replace(/^\//, '').split('/')[0];
  if ((NAV_SECTIONS as readonly string[]).includes(seg)) return seg;
  return null;
}

function activeNavToPath(navId: string): string {
  if (navId === 'admin') return '/admin';
  if (navId === 'saved') return '/vocabulary?tab=saved';
  return `/${navId}`;
}

function authPathFor(view: AuthView): string {
  switch (view) {
    case 'login': return '/auth/login';
    case 'signup': return '/auth/signup';
    case 'forgot-password': return '/auth/forgot-password';
    case 'verify-email': return '/auth/verify-email';
    case 'reset-password': return '/auth/reset-password';
    case 'onboarding': return '/onboarding';
  }
}

function pathToAuthView(pathname: string): AuthView | null {
  if (pathname.startsWith('/auth/login')) return 'login';
  if (pathname.startsWith('/auth/signup')) return 'signup';
  if (pathname.startsWith('/auth/forgot-password')) return 'forgot-password';
  if (pathname.startsWith('/auth/verify-email')) return 'verify-email';
  if (pathname.startsWith('/auth/reset-password')) return 'reset-password';
  if (pathname.startsWith('/onboarding')) return 'onboarding';
  return null;
}

export default function App() {
  // Initialize currentUser from local cache immediately to prevent flash of LandingPage on reload
  const [currentUser, setCurrentUser] = useState<User | null>(authApi.getCachedUser);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => {
    return authApi.getCachedUser() === null;
  });

  // Modals & Drawers
  const [selectedLesson, setSelectedLesson] = useState<VideoLesson | null>(null);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const { lang: currentLang, setLang: setCurrentLang, t } = useLanguage();

  // Account Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // First-time Login Survey Modal
  const [isSurveyOpen, setIsSurveyOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Restore session on mount.
  useEffect(() => {
    perfMarks.mark('restore_session:start');
    authApi.restoreSession().then((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    }).catch(() => {
      setCurrentUser(null);
    }).finally(() => {
      perfMarks.since('restore_session:ready', 'restore_session:start');
      setIsRestoringSession(false);
    });
  }, []);

  // First-time login survey popup.
  useEffect(() => {
    try {
      localStorage.removeItem('hanflix_survey_completed_global');
    } catch {
      // ignore
    }

    if (currentUser && currentUser.role === 'user') {
      const serverSideCompleted = currentUser.learningProfile?.surveyVersion != null;
      const localCompleted = localStorage.getItem(`hanflix_survey_completed_${currentUser.id}`);
      if (!serverSideCompleted && !localCompleted) {
        setIsSurveyOpen(true);
      }
    }
  }, [currentUser]);

  const handleOpenAI = (prompt?: string) => {
    if (prompt) {
      setAiPrompt(prompt);
      setIsAIOpen(true);
    } else {
      setIsAIOpen((prev) => !prev);
    }
  };

  const handleSavePreferences = (updated: Partial<UserProfile>) => {
    if (currentUser?.learningProfile) {
      const hskLevel = updated.hskLevel
        ? Number(updated.hskLevel.replace(/\D/g, ''))
        : currentUser.learningProfile.hskLevel;

      setCurrentUser({
        ...currentUser,
        learningProfile: {
          ...currentUser.learningProfile,
          hskLevel,
          goal: updated.targetGoal ?? currentUser.learningProfile.goal,
          topics: updated.interests ?? currentUser.learningProfile.topics,
          subtitlePreference: updated.subtitleMode
            ? { all: 'all', 'zh-pinyin': 'zh_pinyin', zh: 'zh_only' }[updated.subtitleMode]
            : currentUser.learningProfile.subtitlePreference,
          surveyVersion: currentUser.learningProfile.surveyVersion ?? 1,
        },
      });
    }
  };

  // Dedicated loading preview route — bypass everything.
  if (location.pathname === '/loading') {
    return <HanFlixLoadingScreen />;
  }

  // Branded loading screen during session restore.
  if (isRestoringSession) {
    return <HanFlixLoadingScreen />;
  }

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    navigate('/', { replace: true });
  };

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/auth/login" element={
        currentUser ? (
          currentUser.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/feed" replace />
        ) : (
          <LoginView
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setSelectedLesson(null);
              if (user.role === 'admin') {
                navigate('/admin', { replace: true });
              } else {
                navigate('/feed', { replace: true });
                const serverSideCompleted = user.learningProfile?.surveyVersion != null;
                const localCompleted = localStorage.getItem(`hanflix_survey_completed_${user.id}`);
                if (!serverSideCompleted && !localCompleted && user.role === 'user') {
                  setIsSurveyOpen(true);
                }
              }
            }}
            onNavigateToSignup={() => navigate('/auth/signup')}
            onNavigateToForgotPassword={() => navigate('/auth/forgot-password')}
          />
        )
      } />
      <Route path="/auth/signup" element={
        currentUser ? (
          currentUser.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/feed" replace />
        ) : (
          <SignupView
            onNavigateToLogin={() => navigate('/auth/login')}
            onGoogleSuccess={(user) => {
              setCurrentUser(user);
              setSelectedLesson(null);
              if (user.role === 'admin') {
                navigate('/admin', { replace: true });
              } else {
                navigate('/feed', { replace: true });
                const serverSideCompleted = user.learningProfile?.surveyVersion != null;
                const localCompleted = localStorage.getItem(`hanflix_survey_completed_${user.id}`);
                if (!serverSideCompleted && !localCompleted && user.role === 'user') {
                  setIsSurveyOpen(true);
                }
              }
            }}
          />
        )
      } />
      <Route path="/auth/forgot-password" element={
        <ForgotPasswordView
          onNavigateToLogin={() => navigate('/auth/login')}
          onNavigateToResetPassword={(email) =>
            navigate(`/auth/reset-password?email=${encodeURIComponent(email)}`)
          }
        />
      } />
      <Route path="/auth/verify-email" element={
        <VerifyEmailView onNavigateToLogin={() => navigate('/auth/login')} />
      } />
      <Route path="/auth/reset-password" element={
        <ResetPasswordView
          onNavigateToLogin={() => navigate('/auth/login')}
          initialEmail={new URLSearchParams(location.search).get('email') || ''}
        />
      } />

      {/* Onboarding (requires login) */}
      <Route path="/onboarding" element={
        !currentUser ? (
          <LoginView
            onLoginSuccess={(user) => { setCurrentUser(user); navigate('/onboarding', { replace: true }); }}
            onNavigateToSignup={() => navigate('/auth/signup')}
            onNavigateToForgotPassword={() => navigate('/auth/forgot-password')}
          />
        ) : (
          <OnboardingView
            onCompleteOnboarding={(profile: UserLearningProfile) => {
              if (currentUser) setCurrentUser({ ...currentUser, learningProfile: profile });
              navigate('/', { replace: true });
            }}
            onSkip={() => navigate('/', { replace: true })}
          />
        )
      } />

      {/* Watch route — separate so it can use its own header/full-bleed layout */}
      <Route path="/watch" element={
        !currentUser ? <GuestWatchRoute onNavigateAuth={() => navigate('/auth/login')} /> : (
          <LearnerShell
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            selectedLesson={selectedLesson}
            setSelectedLesson={setSelectedLesson}
            isAIOpen={isAIOpen}
            setIsAIOpen={setIsAIOpen}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            isPreferencesOpen={isPreferencesOpen}
            setIsPreferencesOpen={setIsPreferencesOpen}
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            isSurveyOpen={isSurveyOpen}
            setIsSurveyOpen={setIsSurveyOpen}
            handleOpenAI={handleOpenAI}
            handleSavePreferences={handleSavePreferences}
            handleLogout={handleLogout}
          >
            <LazyRouteBoundary>
              <WatchRoute />
            </LazyRouteBoundary>
          </LearnerShell>
        )
      } />
      <Route path="/watch/:lessonId" element={
        !currentUser ? <Navigate to="/auth/login" replace /> : (
          <LearnerShell
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            selectedLesson={selectedLesson}
            setSelectedLesson={setSelectedLesson}
            isAIOpen={isAIOpen}
            setIsAIOpen={setIsAIOpen}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            isPreferencesOpen={isPreferencesOpen}
            setIsPreferencesOpen={setIsPreferencesOpen}
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            isSurveyOpen={isSurveyOpen}
            setIsSurveyOpen={setIsSurveyOpen}
            handleOpenAI={handleOpenAI}
            handleSavePreferences={handleSavePreferences}
            handleLogout={handleLogout}
          >
            <LazyRouteBoundary>
              <PublishedRoute onAskAI={(p) => handleOpenAI(p)} />
            </LazyRouteBoundary>
          </LearnerShell>
        )
      } />

      {/* Admin routes */}
      <Route path="/admin/*" element={
        !currentUser
          ? <Navigate to="/auth/login" replace />
          : currentUser.role !== 'admin'
            ? <Navigate to="/" replace />
            : <LazyRouteBoundary>
                <AdminShellRoute currentUser={currentUser} onLogout={handleLogout} />
              </LazyRouteBoundary>
      } />

      {/* Dedicated Landing Page routes */}
      <Route path="/landing" element={
        <LandingRoute onSelectSample={(id) => {
          const lesson = SAMPLE_LESSONS.find(l => l.id === id) || SAMPLE_LESSONS[0];
          setSelectedLesson(lesson as unknown as VideoLesson);
          navigate(`/watch/${lesson.id}`);
        }} />
      } />
      <Route path="/welcome" element={<Navigate to="/landing" replace />} />

      {/* Root route: Guest sees Landing page, Learner redirects to /feed, Admin redirects to /admin */}
      <Route path="/" element={
        !currentUser
          ? <LandingRoute onSelectSample={(id) => {
              const lesson = SAMPLE_LESSONS.find(l => l.id === id) || SAMPLE_LESSONS[0];
              setSelectedLesson(lesson as unknown as VideoLesson);
              navigate(`/watch/${lesson.id}`);
            }} />
          : currentUser.role === 'admin'
            ? <Navigate to="/admin" replace />
            : <Navigate to="/feed" replace />
      } />

      {/* Route Aliases & Redirects */}
      <Route path="/videos" element={<Navigate to="/lessons" replace />} />
      <Route path="/videos/:lessonId" element={<VideoToWatchRedirect />} />
      <Route path="/saved" element={<Navigate to="/vocabulary?tab=saved" replace />} />
      <Route path="/favorites" element={<Navigate to="/vocabulary?tab=saved" replace />} />

      <Route path="/:section" element={
        !currentUser
          ? <Navigate to="/auth/login" replace />
          : <LearnerSectionRoute
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              selectedLesson={selectedLesson}
              setSelectedLesson={setSelectedLesson}
              isAIOpen={isAIOpen}
              setIsAIOpen={setIsAIOpen}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              isPreferencesOpen={isPreferencesOpen}
              setIsPreferencesOpen={setIsPreferencesOpen}
              isSettingsOpen={isSettingsOpen}
              setIsSettingsOpen={setIsSettingsOpen}
              isSurveyOpen={isSurveyOpen}
              setIsSurveyOpen={setIsSurveyOpen}
              handleOpenAI={handleOpenAI}
              handleSavePreferences={handleSavePreferences}
              handleLogout={handleLogout}
            />
      } />

      <Route path="*" element={<NotFoundPage showHeader={false} currentUser={currentUser} onNavigateHome={() => navigate('/')} onNavigateLessons={() => navigate('/lessons')} />} />
    </Routes>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Inner route components (extracted to keep <Routes> readable)
// ──────────────────────────────────────────────────────────────────────────

interface ShellProps {
  currentUser: User;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  selectedLesson: VideoLesson | null;
  setSelectedLesson: React.Dispatch<React.SetStateAction<VideoLesson | null>>;
  isAIOpen: boolean;
  setIsAIOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aiPrompt: string;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  isPreferencesOpen: boolean;
  setIsPreferencesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSurveyOpen: boolean;
  setIsSurveyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenAI: (prompt?: string) => void;
  handleSavePreferences: (updated: Partial<UserProfile>) => void;
  handleLogout: () => void;
}

/**
 * Standard learner shell — header + sidebar + main area.
 * Wraps <main> in the global app frame and renders children inside.
 */
function LearnerShell(props: ShellProps & { children: React.ReactNode }) {
  return <LearnerRouteShell {...props}>{props.children}</LearnerRouteShell>;
}

function LearnerRouteShell({
  currentUser,
  setCurrentUser,
  isAIOpen,
  setIsAIOpen,
  aiPrompt,
  setAiPrompt,
  isPreferencesOpen,
  setIsPreferencesOpen,
  isSettingsOpen,
  setIsSettingsOpen,
  isSurveyOpen,
  setIsSurveyOpen,
  handleOpenAI,
  handleSavePreferences,
  handleLogout,
  activeNav: activeNavProp,
  children,
}: ShellProps & { activeNav?: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hanflix_sidebar_collapsed') === 'true';
    }
    return false;
  });

  // Derive activeNav from URL pathname.
  const activeNav = activeNavProp ?? pathToActiveNav(location.pathname) ?? 'feed';

  // Auto-open settings modal if URL is /settings or /profile
  useEffect(() => {
    if (location.pathname === '/settings' || location.pathname === '/profile') {
      setIsSettingsOpen(true);
    }
  }, [location.pathname, setIsSettingsOpen]);

  const { t } = useLanguage();
  const bottomNavItems = [
    { id: 'feed', label: t.nav.feed, icon: Home },
    { id: 'lessons', label: t.nav.lessons, icon: PlaySquare },
    { id: 'vocabulary', label: t.nav.vocabulary, icon: BookMarked },
    { id: 'grammar', label: t.nav.grammar, icon: BookOpenCheck },
    { id: 'roadmap', label: t.nav.roadmap, icon: Map },
  ];

  const [streakDays, setStreakDays] = useState(() => getStreakState().streakCount);

  useEffect(() => {
    const handleStreakUpdate = () => {
      setStreakDays(getStreakState().streakCount);
    };
    window.addEventListener('hanflix:streak-updated', handleStreakUpdate);
    window.addEventListener('storage', handleStreakUpdate);
    return () => {
      window.removeEventListener('hanflix:streak-updated', handleStreakUpdate);
      window.removeEventListener('storage', handleStreakUpdate);
    };
  }, []);

  const userProfile: UserProfile = {
    id: currentUser.id,
    name: currentUser.name,
    role: currentUser.role,
    avatar: currentUser.avatarUrl || currentUser.googleAvatarUrl || currentUser.avatarAsset || '',
    avatarConfig: currentUser.avatarConfig || null,
    level: `HSK ${currentUser.learningProfile?.hskLevel || 3}`,
    hskProgress: 0,
    hskLevel: `HSK ${currentUser.learningProfile?.hskLevel || 3}`,
    streakDays: streakDays,
    targetGoal: currentUser.learningProfile?.goal || 'daily',
    interests: currentUser.learningProfile?.topics || [],
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F7F9] text-[#18181B] flex flex-col font-sans antialiased">
      <Header
        activeNav={activeNav}
        currentLang={useLanguage().lang}
        onLanguageChange={useLanguage().setLang}
        onOpenPreferences={() => setIsSurveyOpen(true)}
        onOpenSettings={() => navigate('/settings')}
        onSearchSelect={(query) => handleOpenAI(`Tìm kiếm: ${query}`)}
        onOpenMenu={() => setIsSidebarOpen(true)}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => {
          const next = !prev;
          if (typeof window !== 'undefined') {
            localStorage.setItem('hanflix_sidebar_collapsed', String(next));
          }
          return next;
        })}
        isSidebarCollapsed={isSidebarCollapsed}
        currentUser={currentUser}
        onLogout={handleLogout}
        streakDays={userProfile.streakDays}
        onOpenPractice={() => navigate('/lessons')}
        onNavigateToLessons={() => navigate('/lessons')}
        onNotificationAction={(actionUrl) => {
          if (!actionUrl) return;
          if (actionUrl.startsWith('/')) {
            navigate(actionUrl);
          } else {
            navigate(`/${actionUrl}`);
          }
        }}
      />

      <div className="flex-1 flex max-w-[1920px] w-full mx-auto min-w-0">
        <div className="shrink-0 sticky top-[68px] self-start h-[calc(100vh-68px)]">
          <Sidebar
            activeNav={activeNav}
            onNavChange={(navId) => navigate(activeNavToPath(navId))}
            userProfile={userProfile}
            onStartPractice={() => navigate('/lessons')}
            isDrawerOpen={isSidebarOpen}
            onCloseDrawer={() => setIsSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
          />
        </div>

        <main className="flex-1 min-w-0 p-3 md:p-5 lg:p-6 pb-24 md:pb-6 space-y-5 overflow-x-hidden overflow-y-auto h-[calc(100vh-68px)]">
          {children}
        </main>
      </div>

      <nav
        aria-label="Điều hướng dưới"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7E7EA] flex items-center safe-area-inset-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(activeNavToPath(item.id))}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 text-[10px] font-bold transition-colors cursor-pointer select-none active:scale-95 ${
                isActive ? 'text-[#B91B1C]' : 'text-[#8B9097] hover:text-[#18181B]'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#B91B1C]' : 'text-[#8B9097]'}`} />
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          if (location.pathname === '/settings' || location.pathname === '/profile') {
            navigate('/', { replace: true });
          }
        }}
        currentUser={currentUser}
        userProfile={userProfile}
        onSavePreferences={handleSavePreferences}
        onOpenSurvey={() => setIsSurveyOpen(true)}
        onUpdateUser={(updated) => setCurrentUser(updated)}
      />

      <LearningSurveyModal
        isOpen={isSurveyOpen}
        onClose={() => setIsSurveyOpen(false)}
        userProfile={userProfile}
        onSavePreferences={handleSavePreferences}
        currentUser={currentUser}
      />

      <AIAssistantDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        initialPrompt={aiPrompt}
        currentUser={currentUser}
      />

      <PreferencesDrawer
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        userProfile={userProfile}
        onSavePreferences={handleSavePreferences}
      />

      {currentUser && <PandaPet onOpenAI={() => handleOpenAI()} isAIOpen={isAIOpen} />}

      <StreakCelebrationToast />
      <XpCelebrationToast />
    </div>
  );
}

/**
 * Renders the appropriate learner page based on URL pathname.
 * Used for routes like /lessons, /saved, /vocabulary, /exam, etc.
 */
function LearnerSectionRoute(props: ShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeNav = pathToActiveNav(location.pathname) ?? 'feed';

  let content: React.ReactNode;
  if (activeNav === 'saved' || activeNav === 'vocabulary' || activeNav === 'roadmap' || activeNav === 'history' ||
      activeNav === 'feed' || activeNav === 'lessons' || activeNav === 'settings' || activeNav === 'profile') {
    content = (
      <ConnectedLearner
        section={activeNav === 'settings' || activeNav === 'profile' ? 'feed' : (activeNav as 'feed' | 'lessons' | 'saved' | 'vocabulary' | 'roadmap' | 'history')}
        onSelectLesson={(id) => navigate(`/watch/${id}`)}
        onOpenPreferences={() => props.setIsSurveyOpen(true)}
        onNavigateSection={(s) => navigate(activeNavToPath(s))}
      />
    );
  } else if (activeNav === 'exam') {
    content = <LazyRouteBoundary><ExamPrepPage onStartPractice={() => navigate('/lessons')} /></LazyRouteBoundary>;
  } else if (activeNav === 'leaderboard') {
    content = <LazyRouteBoundary><LeaderboardPage onStartPractice={() => navigate('/lessons')} onSelectLesson={() => navigate('/lessons')} /></LazyRouteBoundary>;
  } else if (activeNav === 'grammar') {
    content = <GrammarPage onStartPractice={() => navigate('/lessons')} />;
  } else if (activeNav === 'community') {
    content = <LazyRouteBoundary><CommunityPage /></LazyRouteBoundary>;
  } else {
    content = <NotFoundPage
      showHeader={false}
      currentUser={props.currentUser}
      onNavigateHome={() => navigate('/')}
      onNavigateLessons={() => navigate('/lessons')}
    />;
  }

  return <LearnerRouteShell {...props}>{content}</LearnerRouteShell>;
}

/** Guest landing — renders LandingPage or guest WatchView. */
function LandingRoute({ onSelectSample }: { onSelectSample: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-screen">
      <LandingPage
        onStartSurvey={() => navigate('/auth/signup')}
        onViewSample={(id) => {
          if (id) onSelectSample(id);
        }}
        onSignIn={() => navigate('/auth/login')}
        onSignUp={() => navigate('/auth/signup')}
      />
    </div>
  );
}

/** Guest watch view at /watch (no lesson id). */
function GuestWatchRoute({ onNavigateAuth }: { onNavigateAuth: () => void }) {
  const navigate = useNavigate();
  const sample = SAMPLE_LESSONS[0] as unknown as VideoLesson;
  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 md:p-6 bg-[#F7F7F9] min-h-screen">
        <LazyRouteBoundary>
          <WatchView
            lesson={sample}
            onBack={() => navigate('/')}
            onSelectLesson={() => navigate('/auth/login')}
            onAskAI={onNavigateAuth}
            isSaved={false}
            onToggleSave={onNavigateAuth}
            onStartPractice={onNavigateAuth}
            guestMode={true}
          />
        </LazyRouteBoundary>
      </div>
    </div>
  );
}

/** /watch/:lessonId — renders PublishedLessonView. */
function PublishedRoute({ onAskAI }: { onAskAI: (prompt: string) => void }) {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  if (!lessonId) {
    return <Navigate to="/lessons" replace />;
  }

  return (
    <PublishedLessonView
      lessonId={lessonId}
      onBack={() => {
        // Back goes to last nav or /lessons
        const lastNav = localStorage.getItem('hanflix_last_nav');
        const back = lastNav && (NAV_SECTIONS as readonly string[]).includes(lastNav)
          ? activeNavToPath(lastNav)
          : '/lessons';
        navigate(back);
      }}
      subtitlePreference={undefined}
      onSelectLesson={(id) => navigate(`/watch/${id}`)}
      onAskAI={onAskAI}
    />
  );
}

/** /watch (no id) — guest WatchView. */
function WatchRoute() {
  const navigate = useNavigate();
  const sample = SAMPLE_LESSONS[0] as unknown as VideoLesson;
  return (
    <LazyRouteBoundary>
      <WatchView
        lesson={sample}
        onBack={() => navigate('/')}
        onSelectLesson={() => navigate('/auth/login')}
        onAskAI={() => navigate('/auth/login')}
        isSaved={false}
        onToggleSave={() => navigate('/auth/login')}
        onStartPractice={() => navigate('/auth/login')}
        guestMode={true}
      />
    </LazyRouteBoundary>
  );
}

/** Admin shell with URL-driven activeTab + dynamic subroutes. */
function AdminShellRoute({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Parse /admin, /admin/<tab>, /admin/videos/<id>/edit, /admin/processing/<id>, /admin/quiz/<id>, /admin/users/<id>
  const pathAfterAdmin = location.pathname.replace(/^\/admin\/?/, '');
  const parts = pathAfterAdmin.split('/').filter(Boolean);

  let tab: 'overview' | 'videos' | 'upload' | 'processing' | 'editor' | 'quiz' | 'users' | 'vocabulary' | 'grammar' | 'not_found' = 'overview';
  let editingId: string | null = null;
  let processingId: string | null = null;
  let quizLessonId: string | null = null;
  let userId: string | null = null;

  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'overview')) {
    tab = 'overview';
  } else if (parts[0] === 'videos') {
    if (parts.length === 1) {
      tab = 'videos';
    } else if (parts[1] === 'upload') {
      tab = 'upload';
    } else if (parts[1] === 'processing') {
      tab = 'processing';
      processingId = parts[2] || null;
    } else {
      // /admin/videos/:id/edit, /admin/videos/:id/subtitles, /admin/videos/:id/processing, /admin/videos/:id
      const id = parts[1];
      if (parts[2] === 'processing') {
        tab = 'processing';
        processingId = id;
      } else {
        tab = 'editor';
        editingId = id;
      }
    }
  } else if (parts[0] === 'upload') {
    tab = 'upload';
  } else if (parts[0] === 'editor') {
    tab = 'editor';
    editingId = parts[1] || null;
  } else if (parts[0] === 'processing') {
    tab = 'processing';
    processingId = parts[1] || null;
  } else if (parts[0] === 'quiz') {
    tab = 'quiz';
    quizLessonId = parts[1] || null;
  } else if (parts[0] === 'users') {
    tab = 'users';
    userId = parts[1] || null;
  } else if (parts[0] === 'vocabulary') {
    tab = 'vocabulary';
  } else if (parts[0] === 'grammar') {
    tab = 'grammar';
  } else {
    tab = 'not_found';
  }

  type ShellTab = 'overview' | 'videos' | 'upload' | 'users' | 'vocabulary' | 'grammar' | 'quiz';
  const shellTab: ShellTab = 
    (tab === 'editor' || tab === 'processing' || tab === 'videos') ? 'videos' :
    (tab === 'upload') ? 'upload' :
    (tab === 'overview') ? 'overview' :
    (tab === 'quiz') ? 'quiz' :
    (tab === 'users') ? 'users' :
    (tab === 'vocabulary') ? 'vocabulary' :
    (tab === 'grammar') ? 'grammar' : 'overview';

  const handleTabChange = (t: ShellTab) => {
    if (t === 'overview') {
      navigate('/admin');
    } else if (t === 'upload') {
      navigate('/admin/videos/upload');
    } else {
      navigate(`/admin/${t}`);
    }
  };

  if (tab === 'not_found') {
    return (
      <AdminShell
        activeTab="overview"
        onTabChange={handleTabChange}
        currentUser={currentUser}
        onLogout={onLogout}
      >
        <NotFoundPage
          showHeader={false}
          currentUser={currentUser}
          onNavigateHome={() => navigate('/admin')}
          onNavigateLessons={() => navigate('/admin/videos')}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      activeTab={shellTab}
      onTabChange={handleTabChange}
      currentUser={currentUser}
      onLogout={onLogout}
    >
      {tab === 'vocabulary' && <AdminVocabularyManager />}
      {tab === 'grammar' && <AdminGrammarManager />}
      {tab === 'quiz' && <AdminQuizManager lessonId={quizLessonId || undefined} />}
      {tab === 'users' && <AdminUserManager userId={userId || undefined} />}
      {(tab === 'overview' || tab === 'videos' || tab === 'upload' || tab === 'processing' || tab === 'editor') && (
        <ConnectedAdmin
          tab={tab}
          setTab={(t) => {
            if (t === 'overview') navigate('/admin');
            else if (t === 'videos') navigate('/admin/videos');
            else if (t === 'upload') navigate('/admin/videos/upload');
            else if (t === 'processing') navigate('/admin/processing');
            else if (t === 'editor') {
              if (editingId) navigate(`/admin/videos/${editingId}/edit`);
              else navigate('/admin/videos');
            }
            else if (t === 'quiz') navigate('/admin/quiz');
            else if (t === 'users') navigate('/admin/users');
            else if (t === 'vocabulary') navigate('/admin/vocabulary');
            else if (t === 'grammar') navigate('/admin/grammar');
          }}
          editingId={editingId}
          processingId={processingId}
          setEditingId={(id) => {
            if (id) navigate(`/admin/videos/${id}/edit`);
            else navigate('/admin/videos');
          }}
          onSelectProcessingLesson={(id) => {
            if (id) navigate(id ? `/admin/processing/${id}` : '/admin/processing');
            else navigate('/admin/processing');
          }}
        />
      )}
    </AdminShell>
  );
}
