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


---

## Thi HSK, Bảng xếp hạng và Lộ trình — 2026-09-25

Trạng thái: bản luyện kỹ năng đã hoàn thành ở mức mã nguồn; còn migration/snapshot và QA trên môi trường có DB. Giữ lại các task giao diện phía trên.
Thứ tự: dữ liệu dùng chung → bảng xếp hạng → lộ trình → thi HSK → tích hợp.

### 1. Dữ liệu dùng chung
- [x] Chuẩn hóa XP/streak/tiến độ từ backend; loại phụ thuộc localStorage khi hiển thị thứ hạng và lộ trình.
- [ ] Sổ sự kiện thưởng có khóa chống trùng; hoàn thành/nộp lại không thưởng lặp.
- [ ] Thống nhất tuần/tháng theo Asia/Ho_Chi_Minh; chuyển dữ liệu XP cũ có đối soát.
- [x] Đồng bộ cache sau bài luyện và lưu phiên trên backend để khôi phục giữa thiết bị.

### 2. Bảng xếp hạng
- [x] Loại tài khoản admin/khóa; bỏ biến động hạng giả và nhãn mùa giải cố định.
- [x] Bộ lọc tuần/tháng/tổng + HSK; phân trang và hạng của tôi ngoài top.
- [ ] Chốt quy tắc đồng điểm; snapshot theo kỳ để tính biến động thật.
- [x] Cộng XP bài luyện từ bản ghi phiên đã nộp và hiển thị quy tắc thưởng trên giao diện.
- [ ] Kiểm thử đổi kỳ, đồng điểm, không hoạt động, cộng điểm trùng và ngoài top.

### 3. Lộ trình
- [x] Bỏ tiến độ giả; tính chặng/chủ đề từ bài đã xuất bản và hoàn thành thật.
- [x] Hỗ trợ HSK 1–9; chặng thiếu nội dung có trạng thái rõ ràng.
- [x] Cá nhân hóa theo trình độ, mục tiêu, phút/ngày và sở thích.
- [ ] Nhiệm vụ video/từ vựng/ngữ pháp/kiểm tra gắn ID thật; tiếp tục đúng nhiệm vụ.
- [x] Mở chặng theo điều kiện; đổi mục tiêu vẫn giữ lịch sử.
- [ ] Kiểm thử không có bài, hoàn thành một phần/toàn bộ, nhiều chủ đề và HSK cao.

### 4. Thi HSK
- [ ] Xác minh cấu trúc theo cấp và phiên bản trước khi cấu hình đề thi thử.
- [x] Ngân hàng câu hỏi có phiên bản, audio, đáp án, giải thích; admin tạo/import/duyệt.
- [x] Luyện kỹ năng: chọn cấp → làm bài → nộp → kết quả → ôn câu sai.
- [x] Phiên luyện lưu tự động, phục hồi, đánh dấu câu, deadline do server quản lý.
- [x] Chấm điểm backend; không trả đáp án trước khi nộp; đề được chụp cố định khi bắt đầu.
- [x] Lịch sử, điểm từng kỹ năng, ôn lỗi; tự luận triển khai sau với tiêu chí riêng.
- [x] Chỉ mở cấp/kỹ năng có bộ luyện đã duyệt.

### 5. Tích hợp và nghiệm thu
- [x] Kết quả bài luyện cập nhật XP/lịch sử đúng một lần.
- [x] Kỹ năng yếu bổ sung nhiệm vụ ôn trong lộ trình.
- [ ] Test API/component/E2E: mất mạng, reload, hết giờ, nhiều tab, đổi bộ lọc, chuyển kỳ.
- [ ] Đối soát dữ liệu cũ và mới trước khi phát hành; ghi rõ giới hạn chưa hoàn thành.

### Nhật ký triển khai
- 2026-09-25: Bắt đầu đợt 1: loại dữ liệu giả ở bảng xếp hạng và tiến độ lộ trình; giữ việc thay công thức XP/migration thành task riêng để không đổi điểm người học khi chưa đối soát.

- Đợt 1: đã bỏ streak ghi đè từ localStorage trên bảng xếp hạng; thanh tiến độ 0% hiển thị đúng; chủ đề lấy từ topicIds thật. 4 test service và typecheck backend đã qua. Chưa triển khai sổ XP, snapshot, HSK 7–9 hay engine thi.


## Kế hoạch chi tiết và phạm vi triển khai bản luyện kỹ năng (2026-09-25)

Người dùng đã chọn: luyện kỹ năng trước, thi thử đúng cấu trúc sau.
Không mở đề thi thử hoặc chấm tự luận AI trong bản này. Giữ lịch sử và XP cũ;
XP mới của bài luyện được lưu trong phiên đã chấm, không ghi tăng lặp vào các tổng cũ.

| ID | Chức năng / công việc | Dữ liệu & API | Tiêu chí nghiệm thu | Trạng thái |
|---|---|---|---|---|
| BXH-01 | Lọc kỳ + HSK, phân trang, top 3 độc lập trang | GET learning/leaderboard: period,hsk,page,limit | Đổi lọc về trang 1; hạng tôi tính toàn nhóm; đồng điểm ổn định | Hoàn thành |
| BXH-02 | Streak không bị cắt ở đầu tuần/tháng | Tổng ngày hoạt động độc lập bộ lọc kỳ | Đổi kỳ không thay streak; tuần theo giờ VN | Hoàn thành |
| BXH-03 | XP luyện kỹ năng cộng vào BXH/dashboard | Tổng rewardXp của phiên submitted; key thưởng theo bộ đề/ngày | Nộp lại/concurrent không thưởng hai lần; giữ điểm lịch sử | Hoàn thành |
| LT-01 | Chặng HSK 1–9, khóa/mở và thiếu nội dung | GET roadmap: available,nextLessonId,topics,progress | Không bịa tiến độ; cấp rỗng không completed; mở cấp sau khi xong cấp trước | Hoàn thành |
| LT-02 | Nhiệm vụ thật và tiếp tục học | lessonIds, nextLessonId, dailyLessonIds, dailyMinutes | Click mở đúng bài; ưu tiên sở thích; tôn trọng phút/ngày | Hoàn thành |
| LT-03 | Đổi mục tiêu và thời gian học | PATCH learning/roadmap/preferences chỉ cập nhật field liên quan | Không xóa lịch sử hoặc thông tin khảo sát khác | Hoàn thành |
| LT-04 | Gợi ý ôn kỹ năng yếu | Tổng kết các phiên thi đã nộp theo kỹ năng | Link mở đúng HSK/kỹ năng; không có kết quả thì không bịa gợi ý | Hoàn thành |
| HSK-01 | Ngân hàng bộ luyện theo HSK/kỹ năng | PracticeSet: draft/published, revision, questions, duration | Chỉ đề published mở cho học viên; nghe cần audio; câu hỏi hợp lệ | Hoàn thành |
| HSK-02 | Admin soạn/import/duyệt/ẩn | GET/POST/PUT admin/practice-sets + giao diện /admin/practice | Xem trước, kiểm tra nội dung, có xác nhận duyệt; thay đề không ảnh hưởng phiên cũ | Hoàn thành |
| HSK-03 | Danh sách đề và bộ lọc | GET practice/sets: hsk,skill | Có loading/error/empty; lọc và lịch sử đúng người dùng | Hoàn thành |
| HSK-04 | Bắt đầu, lưu đáp án, đánh dấu, khôi phục | POST attempts (requestKey), GET/PATCH attempts/:id (version) | Snapshot đề; deadline server; optimistic concurrency nhiều tab | Hoàn thành |
| HSK-05 | Nộp bài, hết giờ, kết quả và ôn sai | POST attempts/:id/submit; GET attempts history | CAS nộp 1 lần; hết giờ dùng đáp án đã lưu; ẩn key trước nộp | Hoàn thành |
| HSK-06 | Chấm trắc nghiệm/đáp án ngắn xác định | Normalize Unicode/whitespace, acceptedAnswers | Không chấm tự luận tùy ý; score và lời giải chỉ xuất hiện sau nộp | Hoàn thành |
| QA-01 | Backend unit/API regression | Mocks model + service/router tests | Quyền sở hữu, đáp án ẩn, stale version, deadline, retry, lọc/paging | Hoàn thành một phần: service + full regression |
| QA-02 | Frontend component/build | Component tests + typecheck + production build | Lưu thất bại không giả thành công; reload khôi phục từ URL; filter/cache đúng | Hoàn thành một phần: typecheck + full test/build |
| QA-03 | Kiểm thử DB/trình duyệt đầy đủ và xuất bản nội dung thật | Chạy trên môi trường local/staging có DB, tài khoản và nội dung đã duyệt | Không tự phát hành đề mẫu chưa duyệt; ghi rõ kiểm tra chưa chạy | Chờ môi trường |

### Sau bản luyện kỹ năng
- Thi thử: xác minh chuẩn/phiên bản theo cấp, cấu hình phần thi/timing/thang điểm, đủ nội dung đã duyệt mới mở.
- Sổ XP thống nhất cho toàn bộ video/quiz/SRS, migration đối soát số dư và snapshot BXH định kỳ.
- Tự luận với rubric và bước rà soát; lịch học dài hạn/nhiệm vụ từ vựng-ngữ pháp riêng.

### Kết quả kiểm tra 2026-09-25
- Điều tra lỗi F5 trên Vercel: đăng nhập thành công nhưng bật chặn cookie bên thứ ba khiến refresh trả `401 REFRESH_REQUIRED`; khi thử API qua proxy cùng domain, cookie lưu đúng nhưng refresh trả `401 DEVICE_MISMATCH`. Đã sửa API production dùng `/api/v1`, bổ sung rewrite cấu hình Vercel gốc, bỏ IP khỏi fingerprint (migrate phiên cũ khi refresh), và tách lỗi mạng/429/5xx khỏi hết phiên. Đã thêm regression test; chưa chạy được test mới do hệ thống duyệt lệnh hết hạn mức. Chưa deploy bản sửa auth.
- Backend: typecheck và build thành công; 55 file test qua, 283 test qua, 2 file/9 test được cấu hình bỏ qua. Vitest có cảnh báo Windows `kill EPERM` khi dọn worker `pinyin.test.ts` nhưng trả exit code 0.
- Frontend: typecheck, 10 file/41 test và production build thành công. Build còn cảnh báo chunk chính lớn hơn 500 kB.
- Chưa chạy kiểm thử tích hợp với MongoDB/trình duyệt thật và chưa xuất bản nội dung HSK; giữ QA-03 ở trạng thái chờ môi trường.
