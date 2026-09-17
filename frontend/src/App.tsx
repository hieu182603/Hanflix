import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HeroSection from './components/HeroSection';
import AIRecommendationSection from './components/AIRecommendationSection';
import { useLanguage } from './i18n';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import PreferencesDrawer from './components/PreferencesDrawer';
import PracticeModal from './components/PracticeModal';
import LessonsPage from './components/LessonsPage';
import SavedPage from './components/SavedPage';
import RoadmapPage from './components/RoadmapPage';
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
import AdminDashboard from './components/admin/AdminDashboard';
import AdminVideoList from './components/admin/AdminVideoList';
import AdminVideoUpload from './components/admin/AdminVideoUpload';
import AdminVideoProcessing from './components/admin/AdminVideoProcessing';
import AdminVideoEditor from './components/admin/AdminVideoEditor';
import AdminUserList from './components/admin/AdminUserList';

// Auth, Vocabulary & Review
import LoginView from './components/auth/LoginView';
import SignupView from './components/auth/SignupView';
import OnboardingView from './components/auth/OnboardingView';
import ForgotPasswordView from './components/auth/ForgotPasswordView';
import VerifyEmailView from './components/auth/VerifyEmailView';
import ResetPasswordView from './components/auth/ResetPasswordView';
import VocabularyPage from './components/vocabulary/VocabularyPage';
import FlashcardReviewView from './components/review/FlashcardReviewView';

// API auth
import * as authApi from './api/auth';
import { PandaPet } from './components/panda-pet';

import {
  VideoLesson,
  User,
  UserProfile,
  SAMPLE_LESSONS,
  Lesson,
  SavedWord,
  UserLearningProfile,
  SAMPLE_WORDS
} from './data/hanflixData';
import {
  Sparkles, Home, BookOpen, Bookmark, RotateCcw, User as UserIcon, Menu, BookMarked, Settings, Map
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

export default function App() {
  // null = guest, populated = logged-in learner
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<AuthView>(getInitialAuthView);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

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

  useEffect(() => {
    const handlePopState = () => {
      setAuthView(getInitialAuthView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation & Collapsible sidebar state (Requirement 1)
  const [activeNav, setActiveNav] = useState<string>('feed');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hanflix_sidebar_collapsed') === 'true';
    }
    return false;
  });

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
  const [selectedPublishedLessonId, setSelectedPublishedLessonId] = useState<string | null>(null);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState<boolean>(false);
  const [isFlashcardOpen, setIsFlashcardOpen] = useState<boolean>(false);
  const { lang: currentLang, setLang: setCurrentLang, t } = useLanguage();

  // Account Settings Modal (Requirement 2)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // First-time Login Survey Modal (Requirement 3)
  const [isSurveyOpen, setIsSurveyOpen] = useState<boolean>(false);

  // Store data
  const [lessons, setLessons] = useState<Lesson[]>(SAMPLE_LESSONS);
  const [savedWords, setSavedWords] = useState<SavedWord[]>(
    SAMPLE_WORDS.map((w, index) => ({
      userId: 'test',
      wordId: w.id,
      sourceRefs: w.sourceRefs,
      srs: { dueAt: index < 2 ? Date.now() - 1000 : Date.now() + 86400000, intervalDays: 1, repetitions: 0 },
      savedAt: Date.now()
    }))
  );
  const [savedLessons, setSavedLessons] = useState<VideoLesson[]>([]);

  // Try to restore session on mount
  useEffect(() => {
    authApi.restoreSession().then((user) => {
      if (user) setCurrentUser(user);
    }).finally(() => {
      setIsRestoringSession(false);
    });
  }, []);

  // Check first-time login for survey popup (Requirement 3)
  useEffect(() => {
    if (currentUser && currentUser.role === 'user') {
      // Server-side check: if surveyVersion is set, user has completed the survey
      const serverSideCompleted = currentUser.learningProfile?.surveyVersion != null;
      // Fallback: localStorage for backward compatibility
      const localCompleted =
        localStorage.getItem(`hanflix_survey_completed_${currentUser.id}`) ||
        localStorage.getItem('hanflix_survey_completed_global');

      if (!serverSideCompleted && !localCompleted) {
        // Automatically open the survey popup modal on first login
        setIsSurveyOpen(true);
      }
    }
  }, [currentUser]);

  const handleToggleSaveLesson = (lesson: VideoLesson) => {
    setSavedLessons((prev) =>
      prev.some((l) => l.id === lesson.id)
        ? prev.filter((l) => l.id !== lesson.id)
        : [lesson, ...prev]
    );
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    navigateAuth('none');
  };

  // Admin
  const [adminTab, setAdminTab] = useState<'overview' | 'videos' | 'upload' | 'processing' | 'editor' | 'users'>('overview');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [processingUploadData, setProcessingUploadData] = useState<any>(null);

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
        },
      });
    }
  };

  const handleStartProcessing = (data: any) => {
    setProcessingUploadData(data);
    setAdminTab('processing');
  };

  const handleCompleteProcessing = () => {
    const newLesson: Lesson = {
      id: `lesson-${Date.now()}`,
      titleVi: processingUploadData?.titleVi || 'Bài học mới',
      titleZh: processingUploadData?.titleZh || '新课',
      pinyin: 'Xīn kè',
      descriptionVi: processingUploadData?.descriptionVi || '',
      hsk: processingUploadData?.hsk || 3,
      topics: processingUploadData?.topics || ['food'],
      goalTags: ['daily'],
      durationSeconds: 150,
      status: 'draft',
      publishedRevision: 1,
      mediaMode: 'simulation',
      thumbnailAsset: 'https://picsum.photos/seed/new-lesson/600/350',
      glossaryIds: [],
      contentReady: false,
    };
    setLessons([newLesson, ...lessons]);
    setEditingLessonId(newLesson.id);
    setAdminTab('editor');
  };

  const handleSaveAndPublishLesson = (updatedLesson: Lesson) => {
    setLessons(lessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)));
    setAdminTab('videos');
  };

  // Show loading spinner while restoring session
  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F9]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-[#B91B1C] text-white flex items-center justify-center font-black text-xl shadow-lg">H</div>
          <div className="w-6 h-6 border-2 border-[#B91B1C] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Auth screens
  if (authView === 'login') {
    return (
      <LoginView
        onLoginSuccess={(user) => { setCurrentUser(user); navigateAuth('none'); }}
        onNavigateToSignup={() => navigateAuth('signup')}
        onNavigateToForgotPassword={() => navigateAuth('forgot-password')}
      />
    );
  }

  if (authView === 'signup') {
    return (
      <SignupView
        onNavigateToLogin={() => navigateAuth('login')}
        onGoogleSuccess={(user) => { setCurrentUser(user); navigateAuth('none'); }}
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
        {adminTab === 'overview' && (
          <AdminDashboard
            lessons={lessons}
            onNavigateToUpload={() => setAdminTab('upload')}
            onSelectLessonToEdit={(id) => { setEditingLessonId(id); setAdminTab('editor'); }}
          />
        )}
        {adminTab === 'videos' && (
          <AdminVideoList
            lessons={lessons}
            onNavigateToUpload={() => setAdminTab('upload')}
            onEditLesson={(id) => { setEditingLessonId(id); setAdminTab('editor'); }}
            onDeleteLesson={(id) => setLessons(lessons.filter((l) => l.id !== id))}
          />
        )}
        {adminTab === 'upload' && (
          <AdminVideoUpload onStartProcessing={handleStartProcessing} onCancel={() => setAdminTab('videos')} />
        )}
        {adminTab === 'processing' && (
          <AdminVideoProcessing lessonData={processingUploadData} onCompleteProcessing={handleCompleteProcessing} />
        )}
        {adminTab === 'editor' && (
          <AdminVideoEditor
            lesson={lessons.find((l) => l.id === editingLessonId) || lessons[0]}
            onSaveAndPublish={handleSaveAndPublishLesson}
            onCancel={() => setAdminTab('videos')}
          />
        )}
        {adminTab === 'users' && <AdminUserList />}
      </AdminShell>
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
            onStartSurvey={() => navigateAuth('onboarding')}
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
    name: currentUser.name,
    avatar: currentUser.avatarAsset || 'https://picsum.photos/seed/avatar-default/64/64',
    level: `HSK ${currentUser.learningProfile?.hskLevel || 3} Intermediate`,
    hskProgress: 71,
    hskLevel: `HSK ${currentUser.learningProfile?.hskLevel || 3}`,
    streakDays: 14,
    targetGoal: currentUser.learningProfile?.goal || 'Kinh doanh',
    interests: currentUser.learningProfile?.topics || ['Ẩm thực', 'Du lịch'],
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
        onOpenPractice={() => setIsPracticeOpen(true)}
        onNavigateToLessons={() => {
          setActiveNav('lessons');
          setSelectedLesson(null);
          setSelectedPublishedLessonId(null);
        }}
      />

      {/* Main layout with collapsible sidebar */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto min-w-0">
        {/* Sidebar: collapses to w-[72px] mini-rail or expands to w-[260px] */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={(id) => {
            setActiveNav(id);
            setSelectedLesson(null); // Return to list if navigating from watch mode
            setSelectedPublishedLessonId(null);
            setIsSidebarOpen(false);
          }}
          userProfile={userProfile}
          onStartPractice={() => setIsPracticeOpen(true)}
          isDrawerOpen={isSidebarOpen}
          onCloseDrawer={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed || (!!selectedLesson && typeof window !== 'undefined' && window.innerWidth >= 1024)}
        />

        {/* Main content: YouTube Watch Stage or Dashboard Pages */}
        <main className="flex-1 min-w-0 p-3 md:p-5 lg:p-6 pb-24 md:pb-6 space-y-5 overflow-x-hidden">
          {selectedPublishedLessonId ? (
            <PublishedLessonView lessonId={selectedPublishedLessonId} onBack={() => setSelectedPublishedLessonId(null)} />
          ) : selectedLesson ? (
            /* Requirement 4: In-page YouTube-style Watch View */
            <WatchView
              lesson={selectedLesson}
              onBack={() => setSelectedLesson(null)}
              onSelectLesson={(lesson) => setSelectedLesson(lesson)}
              onAskAI={(prompt) => handleOpenAI(prompt)}
              isSaved={savedLessons.some((l) => l.id === selectedLesson.id)}
              onToggleSave={handleToggleSaveLesson}
              onStartPractice={() => setIsPracticeOpen(true)}
              onSaveWord={(word) => {
                setSavedWords((prev) => [
                  {
                    userId: currentUser?.id || 'learner',
                    wordId: `word-${Date.now()}`,
                    sourceRefs: [{ lessonId: selectedLesson.id, cueId: 'cue-1' }],
                    srs: { dueAt: Date.now() + 86400000, intervalDays: 1, repetitions: 0 },
                    savedAt: Date.now(),
                  },
                  ...prev,
                ]);
              }}
            />
          ) : (
            <>
              {activeNav === 'feed' && (
                <>
                  <HeroSection onSelectLesson={setSelectedLesson} />
                  <AIRecommendationSection
                    onSelectLessonId={(id) => { setSelectedLesson(null); setSelectedPublishedLessonId(id); }}
                    onOpenPreferences={() => setIsSurveyOpen(true)}
                  />
                </>
              )}
              {activeNav === 'lessons' && (
                <LessonsPage onSelectLesson={setSelectedLesson} />
              )}
              {activeNav === 'saved' && (
                <SavedPage
                  onSelectLesson={setSelectedLesson}
                  savedWords={savedWords}
                  savedLessons={savedLessons}
                  onRemoveWord={(id) => setSavedWords(savedWords.filter((w) => w.wordId !== id))}
                  onRemoveSavedLesson={(id) => setSavedLessons(savedLessons.filter((l) => l.id !== id))}
                />
              )}
              {activeNav === 'vocabulary' && (
                <VocabularyPage
                  savedWords={savedWords}
                  onStartReviewSession={() => setIsFlashcardOpen(true)}
                  onRemoveWord={(id) => setSavedWords(savedWords.filter((w) => w.wordId !== id))}
                />
              )}
              {activeNav === 'roadmap' && <RoadmapPage />}
              {activeNav === 'exam' && <ExamPrepPage onStartPractice={() => setIsPracticeOpen(true)} />}
              {activeNav === 'leaderboard' && <LeaderboardPage />}
              {activeNav === 'community' && <CommunityPage />}
              {activeNav === 'history' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-black text-[#18181B]">Lịch sử học tập</h1>
                      <p className="text-sm text-[#5F6368] mt-1">Các bài học gần đây của bạn.</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl p-8 border border-[#E7E7EA] text-center">
                    <RotateCcw className="w-10 h-10 text-[#E7E7EA] mx-auto mb-3" />
                    <h2 className="font-bold text-[#18181B] mb-1">Chưa có lịch sử học tập</h2>
                    <p className="text-sm text-[#5F6368]">Bạn chưa xem bài học nào gần đây.</p>
                  </div>
                </div>
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
          const isActive = activeNav === item.id && !selectedLesson;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                setSelectedLesson(null);
              }}
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
      <PracticeModal isOpen={isPracticeOpen} onClose={() => setIsPracticeOpen(false)} />

      {/* Flashcard Review */}
      {isFlashcardOpen && (
        <FlashcardReviewView onClose={() => setIsFlashcardOpen(false)} />
      )}

      {/* Interactive AI Pet & Assistant - ONLY displayed when learner is logged in */}
      {currentUser && <PandaPet onOpenAI={() => handleOpenAI()} />}

      {/* Global Streak Celebration Animated Toast */}
      <StreakCelebrationToast />
    </div>
  );
}
