# HanFlix Responsive Audit & Implementation Plan

## Project Overview
- **Framework**: React 19 + Vite 6.4.3
- **CSS**: Tailwind CSS v4.0.0 + Custom CSS
- **Routing**: React Router DOM 6.30.6
- **Components**: 72 TSX files
- **Breakpoints**: sm:640px, md:768px, lg:1024px, xl:1280px

---

## Phase 1: Foundation & Global Styles

### 1.1 CSS Variables & Breakpoints
**Files**: `src/index.css`

**Tasks**:
- [ ] Add responsive container utilities
- [ ] Add mobile-safe padding variables
- [ ] Add safe-area-inset support for iPhone
- [ ] Add responsive typography scale using clamp()
- [ ] Review and enhance spacing scale for mobile

### 1.2 Global Layout Fixes
**Files**: `src/App.tsx`, `src/index.css`

**Tasks**:
- [ ] Fix viewport height issues (use 100dvh instead of 100vh where needed)
- [ ] Ensure max-width containers work properly on all screens
- [ ] Add horizontal scroll prevention at root level

---

## Phase 2: Header / Navigation

### 2.1 Header Component
**File**: `src/components/Header.tsx`

**Issues to Fix**:
- [ ] Search bar width on mobile (currently `max-w-[500px]`)
- [ ] Action buttons spacing on small screens
- [ ] Logo scaling for mobile
- [ ] Dropdown menus must stay within viewport
- [ ] Safe area padding for iPhone notch
- [ ] Touch target sizes (min 44x44px)

**Mobile Nav Changes**:
- [ ] Hamburger menu shows sidebar drawer (already implemented, verify)
- [ ] Sticky header should handle dynamic island/notch

### 2.2 Sidebar Component
**File**: `src/components/Sidebar.tsx`

**Issues to Fix**:
- [ ] Mobile drawer width (currently 280px - consider full screen on very small phones)
- [ ] Profile card avatar sizing on mobile
- [ ] Navigation items touch targets
- [ ] Drawer overlay scroll prevention
- [ ] Close button accessibility
- [ ] Mobile bottom nav (in App.tsx) - verify touch targets

### 2.3 Bottom Navigation
**File**: `src/App.tsx` (LearnerRouteShell)

**Tasks**:
- [ ] Ensure 5 items fit comfortably on small phones
- [ ] Safe area bottom padding for iPhone home indicator
- [ ] Touch target verification (44x44px minimum)

---

## Phase 3: Landing Page

**File**: `src/components/LandingPage.tsx`

### 3.1 Hero Section
- [ ] Logo size scaling for mobile (< 320px)
- [ ] CTA buttons stacking on mobile
- [ ] Hero text typography (h1 scaling)
- [ ] Hero panda/cloud illustration responsive sizing

### 3.2 Method Section
- [ ] Video mockup responsive height
- [ ] Subtitle layers toggle buttons mobile-friendly
- [ ] 2-column grid on tablet (already: lg:grid-cols-2)

### 3.3 Lessons Catalog
- [ ] Grid: 1 col mobile, 2 col tablet, 3 col desktop
- [ ] Card aspect ratios
- [ ] Filter tabs scrollable on mobile

### 3.4 Testimonials
- [ ] Grid: 1 col mobile, 3 col desktop

### 3.5 FAQ Section
- [ ] Accordion items full width on mobile
- [ ] Panda assistant card responsive

### 3.6 Footer
- [ ] Footer grid: 1 col mobile, 2 col tablet, 12 col desktop
- [ ] Newsletter form mobile-friendly
- [ ] Social buttons wrapping

---

## Phase 4: Learner Pages (ConnectedLearner)

**File**: `src/components/ConnectedLearner.tsx`

### 4.1 Feed Page
- [ ] Lesson card grid responsive
- [ ] AI recommendations section mobile layout
- [ ] Section headers typography

### 4.2 Lessons Page
- [ ] Grid: 1-2 col mobile, 3-4 col desktop
- [ ] Category filters horizontal scroll
- [ ] Sort/filter dropdown mobile-friendly

### 4.3 Saved Page
- [ ] Grid responsive
- [ ] Empty state responsive

### 4.4 Vocabulary Page
- [ ] Word cards grid responsive
- [ ] Flashcard modal mobile-friendly
- [ ] Filter/search bar mobile

### 4.5 Roadmap Page
- [ ] Roadmap visualization responsive
- [ ] Progress cards layout

### 4.6 History Page
- [ ] Study history list responsive
- [ ] Stats cards grid

---

## Phase 5: Watch / Video Player

### 5.1 WatchView Component
**File**: `src/components/watch/WatchView.tsx`

**Tasks**:
- [ ] Video player responsive width (aspect ratio)
- [ ] Controls accessible on touch devices
- [ ] Subtitle display scaling for mobile
- [ ] Related videos grid responsive
- [ ] Lesson info typography

### 5.2 PublishedLessonView Component
**File**: `src/components/watch/PublishedLessonView.tsx`

**Tasks**:
- [ ] Video player full-width on mobile
- [ ] Subtitle overlay positioning
- [ ] AI assistant button positioning
- [ ] Transcript panel mobile layout (drawer vs inline)
- [ ] Lesson navigation mobile-friendly

---

## Phase 6: Leaderboard & Exam Pages

### 6.1 Leaderboard
**File**: `src/components/leaderboard/LeaderboardView.tsx`

**Tasks**:
- [ ] Podium layout responsive
- [ ] Rankings list responsive
- [ ] Tab navigation mobile-friendly
- [ ] User card sizing

### 6.2 Exam Prep
**File**: `src/components/ExamPrepPage.tsx`

**Tasks**:
- [ ] Exam cards grid responsive
- [ ] Progress indicators mobile-friendly
- [ ] CTA buttons sizing

---

## Phase 7: Auth Pages

**Files**: `src/components/auth/*.tsx`

**Tasks**:
- [ ] Login/Signup form full-width on mobile
- [ ] Input field sizes (min 44px height for iOS)
- [ ] Password visibility toggle touch target
- [ ] Social login buttons stacking
- [ ] Auth visual panel hidden on mobile (already: lg:split)
- [ ] Error messages mobile-friendly
- [ ] Forgot password flow responsive

---

## Phase 8: Admin Dashboard

**File**: `src/components/admin/AdminShell.tsx`

**Tasks**:
- [ ] Admin sidebar mobile drawer behavior
- [ ] Admin navigation mobile-friendly
- [ ] Header actions responsive

### 8.1 Admin Video List
**File**: `src/components/admin/AdminVideoList.tsx`

**Tasks**:
- [ ] Data table responsive (horizontal scroll or card view)
- [ ] Action buttons mobile-friendly
- [ ] Search/filter bar responsive

### 8.2 Admin Video Uploader
**File**: `src/components/admin/AdminVideoUploader.tsx`

**Tasks**:
- [ ] Upload zone responsive sizing
- [ ] Form fields mobile-friendly
- [ ] Progress indicators mobile

### 8.3 Admin Lesson Review Studio
**File**: `src/components/admin/AdminLessonReviewStudio.tsx`

**Tasks**:
- [ ] Video editor responsive
- [ ] Subtitle editor mobile layout
- [ ] Control buttons sizing

### 8.4 Admin User/Vocabulary/Grammar Managers
**Tasks**:
- [ ] Table responsive (horizontal scroll)
- [ ] Search/filter responsive
- [ ] Pagination mobile-friendly
- [ ] Action buttons touch targets

---

## Phase 9: Modals & Drawers

### 9.1 Settings Modal
**File**: `src/components/settings/SettingsModal.tsx`

**Tasks**:
- [ ] Modal width responsive (full screen on mobile)
- [ ] Tab navigation mobile-friendly
- [ ] Form inputs sizing
- [ ] Close button accessibility

### 9.2 AI Assistant Drawer
**File**: `src/components/AIAssistantDrawer.tsx`

**Tasks**:
- [ ] Drawer width responsive
- [ ] Chat input mobile-friendly
- [ ] Message bubbles responsive

### 9.3 Preferences Drawer
**File**: `src/components/PreferencesDrawer.tsx`

**Tasks**:
- [ ] Drawer responsive
- [ ] Options selection touch-friendly

### 9.4 Learning Survey Modal
**File**: `src/components/onboarding/LearningSurveyModal.tsx`

**Tasks**:
- [ ] Modal responsive (full screen mobile)
- [ ] Step indicators mobile
- [ ] Option buttons sizing

### 9.5 Flashcard Modal
**File**: `src/components/vocabulary/TopicFlashcardModal.tsx`

**Tasks**:
- [ ] Card flip animation mobile performance
- [ ] Controls sizing
- [ ] Progress bar responsive

---

## Phase 10: Shared Components

### 10.1 LessonCard
**File**: `src/components/LessonCard.tsx`

**Tasks**:
- [ ] Card responsive sizing
- [ ] Thumbnail aspect ratio
- [ ] Action buttons sizing
- [ ] Progress indicator responsive

### 10.2 UserAvatar
**File**: `src/components/common/UserAvatar.tsx`

**Tasks**:
- [ ] Avatar sizing scale
- [ ] Fallback initials responsive

### 10.3 Notifications Dropdown
**File**: `src/components/notifications/NotificationsDropdown.tsx`

**Tasks**:
- [ ] Dropdown width responsive
- [ ] Notification items touch targets

### 10.4 StreakDropdown
**File**: `src/components/streak/StreakDropdown.tsx`

**Tasks**:
- [ ] Dropdown responsive positioning

---

## Phase 11: Typography & Spacing Audit

### 11.1 Typography Scale
**Review all components**:
- [ ] Headings (h1-h6) responsive sizing with clamp()
- [ ] Body text readable on mobile (min 14px)
- [ ] Labels and captions visible
- [ ] Button text not too small

### 11.2 Spacing Scale
- [ ] Audit padding/margin ratios for mobile
- [ ] Ensure consistent spacing tokens
- [ ] Mobile: 12/16/20px vs Desktop: 32/40/48px

---

## Phase 12: Performance & Accessibility

### 12.1 Performance
- [ ] Image lazy loading verified
- [ ] No unnecessary re-renders
- [ ] CSS not causing layout thrashing

### 12.2 Accessibility
- [ ] Focus states visible
- [ ] ARIA labels on icon buttons
- [ ] Keyboard navigation
- [ ] Touch targets 44x44px minimum
- [ ] Color contrast ratios
- [ ] Zoom/browser scaling support

---

## Phase 13: Testing Viewports

### Mobile (320px - 430px)
- [ ] 320 × 568 (iPhone SE)
- [ ] 360 × 800 (Android common)
- [ ] 375 × 667 (iPhone 8)
- [ ] 375 × 812 (iPhone X/11/12/13)
- [ ] 390 × 844 (iPhone 12/13/14)
- [ ] 393 × 852 (Android common)
- [ ] 412 × 915 (Samsung Galaxy)
- [ ] 430 × 932 (iPhone Pro Max)

### Tablet (768px - 1024px)
- [ ] 768 × 1024 (iPad)
- [ ] 810 × 1080 (iPad Air)
- [ ] 820 × 1180 (iPad Pro)
- [ ] 1024 × 1366 (iPad Pro Landscape)

### Desktop (1280px+)
- [ ] 1280 × 720
- [ ] 1366 × 768
- [ ] 1440 × 900
- [ ] 1536 × 864
- [ ] 1920 × 1080
- [ ] 2560 × 1440

---

## Files to Modify (Priority Order)

### High Priority (Core Layout)
1. `src/index.css` - Global styles, variables
2. `src/components/Header.tsx` - Top navigation
3. `src/components/Sidebar.tsx` - Side navigation
4. `src/App.tsx` - Main layout shell

### High Priority (Pages)
5. `src/components/LandingPage.tsx` - Marketing page
6. `src/components/ConnectedLearner.tsx` - Learner pages
7. `src/components/watch/WatchView.tsx` - Guest watch
8. `src/components/watch/PublishedLessonView.tsx` - Lesson view

### Medium Priority
9. `src/components/LessonCard.tsx` - Shared card
10. `src/components/leaderboard/LeaderboardView.tsx` - Rankings
11. `src/components/ExamPrepPage.tsx` - Exam prep

### Medium Priority (Auth)
12. `src/components/auth/LoginView.tsx`
13. `src/components/auth/SignupView.tsx`
14. `src/components/auth/ForgotPasswordView.tsx`

### Lower Priority (Admin)
15. `src/components/admin/AdminShell.tsx`
16. `src/components/admin/AdminVideoList.tsx`
17. `src/components/admin/AdminVideoUploader.tsx`
18. `src/components/admin/AdminLessonReviewStudio.tsx`
19. `src/components/admin/AdminUserManager.tsx`
20. `src/components/admin/AdminVocabularyManager.tsx`
21. `src/components/admin/AdminGrammarManager.tsx`

### Modals & Drawers
22. `src/components/settings/SettingsModal.tsx`
23. `src/components/AIAssistantDrawer.tsx`
24. `src/components/PreferencesDrawer.tsx`
25. `src/components/onboarding/LearningSurveyModal.tsx`
26. `src/components/vocabulary/TopicFlashcardModal.tsx`

---

## Success Criteria

### Must Fix
- [ ] No horizontal scroll on any page (except intentional tables)
- [ ] Navbar usable on mobile
- [ ] Sidebar drawer works on mobile
- [ ] Cards/grid responsive
- [ ] Video player responsive
- [ ] Forms usable on touch devices
- [ ] Modals within viewport
- [ ] Touch targets ≥ 44x44px

### Should Fix
- [ ] Typography scales properly
- [ ] Spacing comfortable on mobile
- [ ] Safe area on iPhone
- [ ] Orientation handling (portrait/landscape)

### Nice to Have
- [ ] Smooth transitions between breakpoints
- [ ] Performance optimization
- [ ] Advanced accessibility features
