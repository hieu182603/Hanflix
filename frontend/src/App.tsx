import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { useLanguage } from './i18n';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import PreferencesDrawer from './components/PreferencesDrawer';
import LandingPage from './components/LandingPage';
import { ExamPrepPage, LeaderboardPage, CommunityPage } from './components/ExamPrepPage';

// Settings & Survey Modals (Requirements 2 & 3)
import SettingsModal from './components/settings/SettingsModal';
import LearningSurveyModal from './components/onboarding/LearningSurveyModal';
import StreakCelebrationToast from './components/streak/StreakCelebrationToast';

// YouTube-Style Watch View (Requirement 4)
import WatchView from './components/watch/WatchView';
import PublishedLessonView from './components/watch/PublishedLessonView';

// Admin Components
import AdminShell from './components/admin/AdminShell';
import AdminVocabularyManager from './components/admin/AdminVocabularyManager';
import AdminGrammarManager from './components/admin/AdminGrammarManager';
import AdminQuizManager from './components/admin/AdminQuizManager';

// Auth, Vocabulary & Review
import LoginView from './components/auth/LoginView';
import SignupView from './components/auth/SignupView';
import OnboardingView from './components/auth/OnboardingView';
import ForgotPasswordView from './components/auth/ForgotPasswordView';
import VerifyEmailView from './components/auth/VerifyEmailView';
import ResetPasswordView from './components/auth/ResetPasswordView';

// API auth
import * as authApi from './api/auth';
import ConnectedLearner from './components/ConnectedLearner';
import ConnectedAdmin from './components/admin/ConnectedAdmin';
import { PandaPet } from './components/panda-pet';
import NotFoundPage from './components/NotFoundPage';
import HanFlixLoadingScreen from './components/HanFlixLoadingScreen';

import {
  VideoLesson,
  User,
  UserProfile,
  SAMPLE_LESSONS,
  UserLearningProfile,
} from './data/hanflixData';
import {
  Home, BookOpen, Bookmark, BookMarked, Map
} from 'lucide-react';

type AuthView = 'none' | 'login' | 'signup' | 'onboarding' | 'forgot-password' | 'verify-email' | 'reset-password';

const getInitialAuthView = (): AuthView => {
  if (typeof window === 'undefined') return 'none';
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/login')) return 'login';
  if (path.includes('/signup') || path.includes('/register')) return 'signup';
  if (path.includes('/forgot')) return 'forgot-password';
  if (path.includes('/verify-email')) return 'verify-email';
  if (path.includes('/reset-password')) return 'reset-password';
  if (path.includes('/onboarding')) return 'onboarding';
  return 'none';
};

const NAV_SECTIONS = ['feed', 'lessons', 'saved', 'vocabulary', 'roadmap', 'history', 'exam', 'leaderboard', 'community'] as const;
type NavSection = typeof NAV_SECTIONS[number];

const isKnownPath = (path: string): boolean => {
  const p = path.toLowerCase();
  if (p === '/' || p === '') return true;
  if (
    p.startsWith('/auth') ||
    p.startsWith('/login') ||
    p.startsWith('/signup') ||
    p.startsWith('/register') ||
    p.startsWith('/forgot') ||
    p.startsWith('/verify-email') ||
    p.startsWith('/reset-password') ||
    p.startsWith('/onboarding') ||
    p.startsWith('/loading') ||
    p.startsWith('/dev') ||
    p.startsWith('/watch') ||
    p.startsWith('/admin')
  ) {
    return true;
  }
  for (const section of NAV_SECTIONS) {
    if (p === `/${section}` || p.startsWith(`/${section}/`)) return true;
  }
  return false;
};

function parseCurrentRoute(): {
  authView: AuthView;
  activeNav: string;
  selectedLessonId: string | null;
  is404: boolean;
} {
  if (typeof window === 'undefined') {
    return { authView: 'none', activeNav: 'feed', selectedLessonId: null, is404: false };
  }

  const p = window.location.pathname.toLowerCase();
  const auth = getInitialAuthView();
  if (auth !== 'none') {
    return { authView: auth, activeNav: 'feed', selectedLessonId: null, is404: false };
  }

  // Watch route: /watch/:lessonId or /watch?id=:lessonId
  if (p.startsWith('/watch')) {
    const parts = window.location.pathname.split('/');
    const lessonId = parts[2] || new URLSearchParams(window.location.search).get('id') || null;
    return { authView: 'none', activeNav: 'lessons', selectedLessonId: lessonId, is404: false };
  }

  // Known nav sections
  for (const section of NAV_SECTIONS) {
    if (p === `/${section}`) {
      return { authView: 'none', activeNav: section, selectedLessonId: null, is404: false };
    }
  }

  // Admin / loading / root
  if (p === '/admin' || p.startsWith('/admin/')) {
    return { authView: 'none', activeNav: 'admin', selectedLessonId: null, is404: false };
  }

  if (p === '/' || p === '' || p.startsWith('/loading') || p.startsWith('/dev')) {
    const savedNav = localStorage.getItem('hanflix_last_nav');
    const nav = (savedNav && NAV_SECTIONS.includes(savedNav as any)) ? savedNav : 'feed';
    return { authView: 'none', activeNav: nav, selectedLessonId: null, is404: false };
  }

  return { authView: 'none', activeNav: 'feed', selectedLessonId: null, is404: !isKnownPath(p) };
}

export default function App() {
  const initialRoute = parseCurrentRoute();
  // Initialize currentUser from local cache immediately to prevent flash of LandingPage on reload
  const [currentUser, setCurrentUser] = useState<User | null>(authApi.getCachedUser);
  const [authView, setAuthView] = useState<AuthView>(initialRoute.authView);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => {
    return authApi.getCachedUser() === null;
  });
  const [is404Route, setIs404Route] = useState<boolean>(initialRoute.is404);

  // Navigation & Collapsible sidebar state
  const [activeNav, setActiveNav] = useState<string>(initialRoute.activeNav);
  const [selectedPublishedLessonId, setSelectedPublishedLessonId] = useState<string | null>(initialRoute.selectedLessonId);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hanflix_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const navigateAuth = (view: AuthView) => {
    setAuthView(view);
    const targetPath =
      view === 'login' ? '/auth/login' :
      view === 'signup' ? '/auth/signup' :
      view === 'forgot-password' ? '/auth/forgot-password' :
      view === 'verify-email' ? '/auth/verify-email' :
      view === 'reset-password' ? '/auth/reset-password' :
      view === 'onboarding' ? '/onboarding' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleNavChange = (navId: string) => {
    setActiveNav(navId);
    setSelectedLesson(null);
    setSelectedPublishedLessonId(null);
    setIsSidebarOpen(false);
    setIs404Route(false);
    localStorage.setItem('hanflix_last_nav', navId);
    const targetPath = navId === 'feed' ? '/' : `/${navId}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLesson(null);
    setSelectedPublishedLessonId(lessonId);
    const targetPath = `/watch/${lessonId}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleBackFromLesson = () => {
    setSelectedPublishedLessonId(null);
    const targetPath = activeNav === 'feed' ? '/' : `/${activeNav}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      setAuthView(route.authView);
      setActiveNav(route.activeNav);
      setSelectedPublishedLessonId(route.selectedLessonId);
      setIs404Route(route.is404);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hanflix_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Modals & Drawers
  const [selectedLesson, setSelectedLesson] = useState<VideoLesson | null>(null);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const { lang: currentLang, setLang: setCurrentLang, t } = useLanguage();

  // Account Settings Modal (Requirement 2)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // First-time Login Survey Modal (Requirement 3)
  const [isSurveyOpen, setIsSurveyOpen] = useState<boolean>(false);

  // Try to restore session on mount (silently refreshes token if cached user exists)
  useEffect(() => {
    authApi.restoreSession().then((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    }).catch(() => {
      setCurrentUser(null);
    }).finally(() => {
      setIsRestoringSession(false);
    });
  }, []);


  // Check first-time login for survey popup (Requirement 3)
  useEffect(() => {
    // Clean up deprecated global key to prevent blocking new accounts
    try {
      localStorage.removeItem('hanflix_survey_completed_global');
    } catch {
      // ignore
    }

    if (currentUser && currentUser.role === 'user') {
      // Server-side check: if surveyVersion is set, user has completed the survey
      const serverSideCompleted = currentUser.learningProfile?.surveyVersion != null;
      // Fallback: localStorage per user ID
      const localCompleted = localStorage.getItem(`hanflix_survey_completed_${currentUser.id}`);

      if (!serverSideCompleted && !localCompleted) {
        // Automatically open the survey popup modal on first login
        setIsSurveyOpen(true);
      }
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    navigateAuth('none');
  };

  // Admin
  const [adminTab, setAdminTab] = useState<'overview' | 'videos' | 'upload' | 'processing' | 'editor' | 'users' | 'vocabulary' | 'grammar' | 'quiz'>('overview');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

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
          // Mark survey as completed so the modal won't re-appear on next login
          surveyVersion: currentUser.learningProfile.surveyVersion ?? 1,
        },
      });
    }
  };

  // Dedicated loading preview route
  if (typeof window !== 'undefined' && window.location.pathname === '/loading') {
    return <HanFlixLoadingScreen />;
  }

  // Show branded loading screen while restoring session
  if (isRestoringSession) {
    return <HanFlixLoadingScreen />;
  }

  // Auth screens
  if (authView === 'login') {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setSelectedLesson(null);
          navigateAuth('none');
          const serverSideCompleted = user.learningProfile?.surveyVersion != null;
          const localCompleted = localStorage.getItem(`hanflix_survey_completed_${user.id}`);
          if (!serverSideCompleted && !localCompleted && user.role === 'user') {
            setIsSurveyOpen(true);
          }
        }}
        onNavigateToSignup={() => navigateAuth('signup')}
        onNavigateToForgotPassword={() => navigateAuth('forgot-password')}
      />
    );
  }

  if (authView === 'signup') {
    return (
      <SignupView
        onNavigateToLogin={() => navigateAuth('login')}
        onGoogleSuccess={(user) => {
          setCurrentUser(user);
          setSelectedLesson(null);
          navigateAuth('none');
          const serverSideCompleted = user.learningProfile?.surveyVersion != null;
          const localCompleted = localStorage.getItem(`hanflix_survey_completed_${user.id}`);
          if (!serverSideCompleted && !localCompleted && user.role === 'user') {
            setIsSurveyOpen(true);
          }
        }}
      />
    );
  }

  if (authView === 'forgot-password') {
    return (
      <ForgotPasswordView
        onNavigateToLogin={() => navigateAuth('login')}
        onNavigateToResetPassword={(email) => {
          navigateAuth('reset-password');
          window.history.replaceState({}, '', `/auth/reset-password?email=${encodeURIComponent(email)}`);
        }}
      />
    );
  }

  if (authView === 'verify-email') {
    return <VerifyEmailView onNavigateToLogin={() => navigateAuth('login')} />;
  }

  if (authView === 'reset-password') {
    const emailParam = new URLSearchParams(window.location.search).get('email') || '';
    return <ResetPasswordView onNavigateToLogin={() => navigateAuth('login')} initialEmail={emailParam} />;
  }

  if (authView === 'onboarding') {
    if (!currentUser) return <LoginView onLoginSuccess={(user) => { setCurrentUser(user); navigateAuth('onboarding'); }} onNavigateToSignup={() => navigateAuth('signup')} onNavigateToForgotPassword={() => navigateAuth('forgot-password')} />;
    return (
      <OnboardingView
        onCompleteOnboarding={(profile: UserLearningProfile) => {
          if (currentUser) setCurrentUser({ ...currentUser, learningProfile: profile });
          navigateAuth('none');
        }}
        onSkip={() => navigateAuth('none')}
      />
    );
  }

  // Admin portal
  if (currentUser?.role === 'admin') {
    return (
      <AdminShell
        activeTab={adminTab === 'processing' || adminTab === 'editor' ? 'videos' : adminTab}
        onTabChange={(tab) => setAdminTab(tab)}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        {adminTab !== 'vocabulary' && adminTab !== 'grammar' && adminTab !== 'quiz' && (
          <ConnectedAdmin
            tab={adminTab}
            setTab={setAdminTab}
            editingId={editingLessonId}
            setEditingId={setEditingLessonId}
          />
        )}        {adminTab === 'vocabulary' && <AdminVocabularyManager />}
        {adminTab === 'grammar' && <AdminGrammarManager />}
        {adminTab === 'quiz' && <AdminQuizManager />}
      </AdminShell>
    );
  }

  // 404 Route handler (for broken URLs or direct /404 navigation)
  if (is404Route) {
    return (
      <NotFoundPage
        showHeader={true}
        currentUser={currentUser}
        onNavigateHome={() => {
          setIs404Route(false);
          setActiveNav('feed');
          window.history.pushState({}, '', '/');
        }}
        onNavigateLessons={() => {
          setIs404Route(false);
          setActiveNav('lessons');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // Guest landing page (not logged in)
  if (!currentUser) {
    return (
      <div className="flex flex-col min-h-screen">
        {selectedLesson ? (
          <div className="p-4 md:p-6 bg-[#F7F7F9] min-h-screen">
            <WatchView
              lesson={selectedLesson}
              onBack={() => setSelectedLesson(null)}
              onSelectLesson={(l) => setSelectedLesson(l)}
              onAskAI={() => navigateAuth('login')}
              isSaved={false}
              onToggleSave={() => navigateAuth('login')}
              onStartPractice={() => navigateAuth('login')}
              guestMode={true}
            />
          </div>
        ) : (
          <LandingPage
            onStartSurvey={() => navigateAuth('signup')}
            onViewSample={(id) => {
              const lesson = SAMPLE_LESSONS.find(l => l.id === id) || SAMPLE_LESSONS[0];
              setSelectedLesson(lesson as unknown as VideoLesson);
            }}
            onSignIn={() => navigateAuth('login')}
            onSignUp={() => navigateAuth('signup')}
          />
        )}
      </div>
    );
  }

  // Bottom nav items for mobile (<768px)
  const bottomNavItems = [
    { id: 'feed', label: t.nav.feed, icon: Home },
    { id: 'lessons', label: t.nav.lessons, icon: BookOpen },
    { id: 'saved', label: t.nav.saved, icon: Bookmark },
    { id: 'vocabulary', label: t.nav.vocabulary, icon: BookMarked },
    { id: 'roadmap', label: t.nav.roadmap, icon: Map },
  ];

  const userProfile = {
    id: currentUser.id,
    name: currentUser.name,
    avatar: currentUser.avatarUrl || currentUser.googleAvatarUrl || currentUser.avatarAsset || '',
    avatarConfig: currentUser.avatarConfig || null,
    level: `HSK ${currentUser.learningProfile?.hskLevel || 3}`,

    hskProgress: 0,
    hskLevel: `HSK ${currentUser.learningProfile?.hskLevel || 3}`,
    streakDays: 0,
    targetGoal: currentUser.learningProfile?.goal || 'daily',
    interests: currentUser.learningProfile?.topics || [],
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F7F9] text-[#18181B] flex flex-col font-sans antialiased">
      {/* Sticky header with collapse hamburger & account settings dropdown */}
      <Header
        activeNav={activeNav}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        onOpenPreferences={() => setIsSurveyOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSearchSelect={(query) => handleOpenAI(`Tìm kiếm: ${query}`)}
        onOpenMenu={() => setIsSidebarOpen(true)}
        onToggleCollapse={handleToggleSidebarCollapse}
        isSidebarCollapsed={isSidebarCollapsed}
        currentUser={currentUser}
        onLogout={handleLogout}
        streakDays={userProfile.streakDays}
        onOpenPractice={() => handleNavChange('lessons')}
        onNavigateToLessons={() => handleNavChange('lessons')}
      />

      {/* Main layout with collapsible sidebar */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto min-w-0">
        {/* Sidebar: collapses to w-[72px] mini-rail or expands to w-[260px] */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          userProfile={userProfile}
          onStartPractice={() => handleNavChange('lessons')}
          isDrawerOpen={isSidebarOpen}
          onCloseDrawer={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
        />

        {/* Main content: YouTube Watch Stage or Dashboard Pages */}
        <main className="flex-1 min-w-0 p-3 md:p-5 lg:p-6 pb-24 md:pb-6 space-y-5 overflow-x-hidden">
          {selectedPublishedLessonId ? (
            <PublishedLessonView lessonId={selectedPublishedLessonId} onBack={handleBackFromLesson} subtitlePreference={currentUser.learningProfile?.subtitlePreference} />
          ) : (
            <>
              {(['feed', 'lessons', 'saved', 'vocabulary', 'roadmap', 'history'] as const).some(section => section === activeNav) && (
                <ConnectedLearner
                  section={activeNav as 'feed' | 'lessons' | 'saved' | 'vocabulary' | 'roadmap' | 'history'}
                  onSelectLesson={handleSelectLesson}
                  onOpenPreferences={() => setIsSurveyOpen(true)}
                />
              )}
              {activeNav === 'exam' && <ExamPrepPage onStartPractice={() => handleNavChange('lessons')} />}
              {activeNav === 'leaderboard' && <LeaderboardPage onStartPractice={() => handleNavChange('lessons')} onSelectLesson={() => handleNavChange('lessons')} />}
              {activeNav === 'community' && <CommunityPage />}
              {!['feed', 'lessons', 'saved', 'vocabulary', 'roadmap', 'exam', 'leaderboard', 'community', 'history'].includes(activeNav) && (
                <NotFoundPage
                  showHeader={false}
                  currentUser={currentUser}
                  onNavigateHome={() => handleNavChange('feed')}
                  onNavigateLessons={() => handleNavChange('lessons')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation (<768px) */}
      <nav
        aria-label="Điều hướng dưới"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E7E7EA] flex items-center safe-area-inset-bottom"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id && !selectedLesson && !selectedPublishedLessonId;
          return (
            <button
              key={item.id}
              onClick={() => handleNavChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-bold transition-colors cursor-pointer ${
                isActive ? 'text-[#B91B1C]' : 'text-[#8B9097]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#B91B1C]' : 'text-[#8B9097]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>


      {/* Requirement 2: Account Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        userProfile={userProfile}
        onSavePreferences={handleSavePreferences}
        onOpenSurvey={() => setIsSurveyOpen(true)}
        onUpdateUser={(updated) => setCurrentUser(updated)}
      />


      {/* Requirement 3: First-time Login Survey Modal */}
      <LearningSurveyModal
        isOpen={isSurveyOpen}
        onClose={() => setIsSurveyOpen(false)}
        userProfile={userProfile}
        onSavePreferences={handleSavePreferences}
        currentUser={currentUser}
      />

      {/* AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        initialPrompt={aiPrompt}
        currentUser={currentUser}
      />

      {/* Preferences Drawer */}
      <PreferencesDrawer
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        userProfile={userProfile}
        onSavePreferences={handleSavePreferences}
      />

      {/* Practice Modal */}
      {/* Interactive AI Pet & Assistant - ONLY displayed when learner is logged in */}
      {currentUser && <PandaPet onOpenAI={() => handleOpenAI()} isAIOpen={isAIOpen} />}

      {/* Global Streak Celebration Animated Toast */}
      <StreakCelebrationToast />
    </div>
  );
}
