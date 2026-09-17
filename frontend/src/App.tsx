import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import HeroSection from './components/HeroSection';
import AIRecommendationSection from './components/AIRecommendationSection';
import VideoPlayerModal from './components/VideoPlayerModal';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import PreferencesDrawer from './components/PreferencesDrawer';
import PracticeModal from './components/PracticeModal';
import LessonsPage from './components/LessonsPage';
import SavedPage from './components/SavedPage';
import RoadmapPage from './components/RoadmapPage';
import LandingPage from './components/LandingPage';
import { ExamPrepPage, LeaderboardPage, CommunityPage, SettingsPage } from './components/ExamPrepPage';

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
  Sparkles, Home, BookOpen, Bookmark, RotateCcw, User as UserIcon, Menu, BookMarked, Settings
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

  // Navigation
  const [activeNav, setActiveNav] = useState<string>('feed');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals / Drawers
  const [selectedLesson, setSelectedLesson] = useState<VideoLesson | null>(null);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState<boolean>(false);
  const [isFlashcardOpen, setIsFlashcardOpen] = useState<boolean>(false);
  const [currentLang, setCurrentLang] = useState<string>('vi');

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
      />
    );
  }

  if (authView === 'forgot-password') {
    return (
      <ForgotPasswordView
        onNavigateToLogin={() => navigateAuth('login')}
      />
    );
  }

  if (authView === 'verify-email') {
    return <VerifyEmailView onNavigateToLogin={() => navigateAuth('login')} />;
  }

  if (authView === 'reset-password') {
    return <ResetPasswordView onNavigateToLogin={() => navigateAuth('login')} />;
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
        <LandingPage
          onStartSurvey={() => navigateAuth('onboarding')}
          onViewSample={(id) => {
            const lesson = SAMPLE_LESSONS.find(l => l.id === id) || SAMPLE_LESSONS[0];
            setSelectedLesson(lesson as unknown as VideoLesson);
          }}
          onSignIn={() => navigateAuth('login')}
          onSignUp={() => navigateAuth('signup')}
        />
        {/* Sample player for guest */}
        <VideoPlayerModal
          lesson={selectedLesson}
          onClose={() => setSelectedLesson(null)}
          onAskAI={() => navigateAuth('login')}
          isSaved={false}
          onToggleSave={() => navigateAuth('login')}
          guestMode={true}
        />
      </div>
    );
  }

  // Bottom nav items for mobile (<768px)
  const bottomNavItems = [
    { id: 'feed', label: 'Bảng tin', icon: Home },
    { id: 'lessons', label: 'Bài học', icon: BookOpen },
    { id: 'saved', label: 'Kho lưu', icon: Bookmark },
    { id: 'vocabulary', label: 'Từ vựng', icon: BookMarked },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
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

      {/* Sticky header */}
      <Header
        activeNav={activeNav}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onOpenAI={() => handleOpenAI()}
        onSearchSelect={(query) => handleOpenAI(`Tìm kiếm: ${query}`)}
        onOpenMenu={() => setIsSidebarOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        streakDays={userProfile.streakDays}
      />

      {/* Main layout */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto min-w-0">
        {/* Sidebar (full, rail, or drawer depending on breakpoint) */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={(id) => { setActiveNav(id); setIsSidebarOpen(false); }}
          userProfile={userProfile}
          onStartPractice={() => setIsPracticeOpen(true)}
          isDrawerOpen={isSidebarOpen}
          onCloseDrawer={() => setIsSidebarOpen(false)}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 p-3 md:p-5 lg:p-6 pb-24 md:pb-6 space-y-5 overflow-x-hidden">
          {activeNav === 'feed' && (
            <>
              <HeroSection onSelectLesson={setSelectedLesson} />
              <AIRecommendationSection
                onSelectLesson={setSelectedLesson}
                onOpenPreferences={() => setIsPreferencesOpen(true)}
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
          {activeNav === 'settings' && (
            <div className="space-y-5">
              <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA]">
                <h1 className="text-xl font-black text-[#18181B] mb-1">Cài đặt tài khoản</h1>
                <p className="text-sm text-[#5F6368] mb-5">Thông tin cơ bản và tùy chọn học tập.</p>
                <div className="space-y-3">
                  {[
                    { label: 'Họ và tên', value: currentUser.name },
                    { label: 'Email', value: currentUser.email },
                    { label: 'Vai trò', value: (currentUser.role as string) === 'admin' ? 'Quản trị viên' : 'Học viên' },
                    { label: 'Trạng thái', value: currentUser.status === 'active' ? 'Hoạt động' : 'Bị khóa' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between py-3 border-b border-[#E7E7EA] last:border-0">
                      <span className="text-sm text-[#5F6368]">{item.label}</span>
                      <span className="text-sm font-semibold text-[#18181B]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA]">
                <h2 className="font-bold text-[#18181B] mb-4">Tùy chọn học tập</h2>
                <button
                  onClick={() => setIsPreferencesOpen(true)}
                  className="w-full h-11 rounded-xl border border-[#E7E7EA] text-sm font-bold text-[#5F6368] hover:bg-[#F7F7F9] transition-colors"
                >
                  Cập nhật mục tiêu và sở thích
                </button>
                <button
                  onClick={() => navigateAuth('onboarding')}
                  className="mt-3 w-full h-11 rounded-xl border border-[#E7E7EA] text-sm font-bold text-[#5F6368] hover:bg-[#F7F7F9] transition-colors"
                >
                  Làm lại khảo sát hướng học
                </button>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA]">
                <button
                  onClick={handleLogout}
                  className="w-full h-11 rounded-xl border border-red-200 text-sm font-bold text-[#B91B1C] hover:bg-red-50 transition-colors"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
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
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-bold transition-colors ${
                isActive ? 'text-[#B91B1C]' : 'text-[#8B9097]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#B91B1C]' : 'text-[#8B9097]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Drawers */}
      <VideoPlayerModal
        lesson={selectedLesson}
        onClose={() => setSelectedLesson(null)}
        onAskAI={(prompt) => { setSelectedLesson(null); handleOpenAI(prompt); }}
        isSaved={selectedLesson ? savedLessons.some((l) => l.id === selectedLesson.id) : false}
        onToggleSave={handleToggleSaveLesson}
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

      <PracticeModal isOpen={isPracticeOpen} onClose={() => setIsPracticeOpen(false)} />

      {isFlashcardOpen && (
        <FlashcardReviewView onClose={() => setIsFlashcardOpen(false)} />
      )}

      {/* Interactive AI Pet & Assistant - ONLY displayed when learner is logged in */}
      {currentUser && <PandaPet onOpenAI={() => handleOpenAI()} />}
    </div>
  );
}
