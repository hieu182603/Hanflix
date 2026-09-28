import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'vi' | 'en' | 'zh';

export interface Translations {
  nav: {
    feed: string;
    lessons: string;
    saved: string;
    vocabulary: string;
    roadmap: string;
    history: string;
    exam: string;
    leaderboard: string;
    community: string;
    grammar: string;
    startReview: string;
    settings: string;
    logout: string;
  };
  header: {
    searchPlaceholder: string;
    searchSuggestions: string;
    noResults: string;
    streakDays: string;
    notifications: string;
    markAllRead: string;
    all: string;
    unread: string;
    study: string;
    system: string;
    noNotifications: string;
    noNotificationsSub: string;
    language: string;
    accountSettings: string;
    learningSurvey: string;
    logout: string;
    learner: string;
    activeStatus: string;
  };
  watch: {
    backToFeed: string;
    topic: string;
    views: string;
    interactiveLesson: string;
    save: string;
    saved: string;
    askAi: string;
    practice: string;
    share: string;
    copied: string;
    copyToast: string;
    follow: string;
    following: string;
    academy: string;
    academySub: string;
    infoAndContext: string;
    showMore: string;
    showLess: string;
    academicHighlights: string;
    transcriptTab: string;
    vocabularyTab: string;
    grammarTab: string;
    seekPrompt: string;
    listenPronunciation: string;
    saveWordTooltip: string;
    savedWordToast: string;
    upNext: string;
    recommendedCount: string;
    subBilingual: string;
    subHanPinyin: string;
    subHanziOnly: string;
    subOff: string;
    guestBannerTitle: string;
    guestBannerDesc: string;
  };
  feed: {
    watchNow: string;
    recommendedForYou: string;
    basedOnProfile: string;
    preferences: string;
    filterAll: string;
    filterHsk3: string;
    filterBusiness: string;
    filterTravel: string;
    filterFood: string;
    sampleLesson: string;
  };
  settings: {
    title: string;
    subtitle: string;
    tabProfile: string;
    tabLearning: string;
    tabSecurity: string;
    fullName: string;
    email: string;
    role: string;
    surveyCtaTitle: string;
    surveyCtaDesc: string;
    retakeSurvey: string;
    saveLearningPrefs: string;
    prefSavedSuccess: string;
    subModeLabel: string;
    subAllTitle: string;
    subAllDesc: string;
    subPinyinTitle: string;
    subPinyinDesc: string;
    subZhTitle: string;
    subZhDesc: string;
    audioInteraction: string;
    autoPronounceTitle: string;
    autoPronounceDesc: string;
    defaultSpeedTitle: string;
    defaultSpeedDesc: string;
    currentPass: string;
    newPass: string;
    confirmPass: string;
    updatePass: string;
  };
  survey: {
    title: string;
    step: string;
    subtitle: string;
    welcomeTitle: string;
    welcomeDesc: string;
    q1Title: string;
    q1Desc: string;
    q2Title: string;
    q2Desc: string;
    q3Title: string;
    q3Desc: string;
    q4Title: string;
    q4Desc: string;
    habitsTitle: string;
    subtitlesTitle: string;
    back: string;
    next: string;
    skip: string;
    finish: string;
  };
  streak: {
    title: string;
    subtitle: string;
    daysCount: string;
    statusActive: string;
    statusCompletedToday: string;
    statusPendingToday: string;
    todayGoal: string;
    goalTargetLabel: string;
    minutesGoal: string;
    studyNowCta: string;
    markCompletedCta: string;
    completedTodayBadge: string;
    freezeTitle: string;
    freezeDesc: string;
    freezeAvailable: string;
    freezeEquipCta: string;
    freezeEquippedToast: string;
    milestoneTitle: string;
    longestStreak: string;
    totalDaysLearned: string;
    retentionRate: string;
    weekdays: {
      mon: string;
      tue: string;
      wed: string;
      thu: string;
      fri: string;
      sat: string;
      sun: string;
    };
    milestones: {
      m7: string;
      m14: string;
      m30: string;
      m60: string;
      reached: string;
      current: string;
      upcoming: string;
    };
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  vi: {
    nav: {
      feed: 'Bảng tin',
      lessons: 'Reels',
      saved: 'Kho lưu trữ',
      vocabulary: 'Từ vựng',
      roadmap: 'Lộ trình',
      history: 'Lịch sử học',
      exam: 'Thi HSK',
      leaderboard: 'Bảng xếp hạng',
      community: 'Cộng đồng',
      grammar: 'Ngữ pháp',
      startReview: 'Bắt đầu ôn tập',
      settings: 'Cài đặt',
      logout: 'Đăng xuất',
    },
    header: {
      searchPlaceholder: 'Tìm kiếm video, từ vựng, ngữ pháp...',
      searchSuggestions: 'Gợi ý tìm kiếm',
      noResults: 'Không tìm thấy bài học phù hợp',
      streakDays: 'ngày streak',
      notifications: 'Thông báo',
      markAllRead: 'Đánh dấu tất cả đã đọc',
      all: 'Tất cả',
      unread: 'Chưa đọc',
      study: 'Học tập',
      system: 'Hệ thống',
      noNotifications: 'Không có thông báo mới',
      noNotificationsSub: 'Bạn đã xem hết các thông báo gần đây.',
      language: 'Ngôn ngữ giao diện',
      accountSettings: 'Cài đặt tài khoản',
      learningSurvey: 'Khảo sát sở thích học',
      logout: 'Đăng xuất',
      learner: 'Học viên',
      activeStatus: 'Tài khoản hoạt động',
    },
    watch: {
      backToFeed: 'Quay lại Bảng tin',
      topic: 'Chủ đề',
      views: 'lượt xem',
      interactiveLesson: 'Bài giảng tương tác AI',
      save: 'Lưu bài',
      saved: 'Đã lưu',
      askAi: 'Hỏi AI về bài này',
      practice: 'Luyện trắc nghiệm',
      share: 'Chia sẻ',
      copied: 'Đã chép',
      copyToast: 'Đã sao chép liên kết bài học!',
      follow: 'Theo dõi',
      following: 'Đang theo dõi',
      academy: 'HanFlix Chinese Academy',
      academySub: 'Giáo trình tương tác HSK chuẩn mới · 14.8K học viên',
      infoAndContext: 'Thông tin bài giảng & Ngữ cảnh văn hóa',
      showMore: 'Hiện thêm',
      showLess: 'Thu gọn',
      academicHighlights: 'Điểm nhấn học thuật trong video:',
      transcriptTab: 'Lời thoại',
      vocabularyTab: 'Từ vựng',
      grammarTab: 'Ngữ pháp',
      seekPrompt: 'Bấm vào câu để phát âm và nhảy tới đoạn video:',
      listenPronunciation: 'Nghe phát âm chuẩn',
      saveWordTooltip: 'Lưu từ vựng này',
      savedWordToast: 'Đã lưu vào sổ tay từ vựng!',
      upNext: 'Bài học tiếp theo',
      recommendedCount: 'bài gợi ý',
      subBilingual: 'Phụ đề: Song ngữ',
      subHanPinyin: 'Phụ đề: Hán & Pinyin',
      subHanziOnly: 'Phụ đề: Chỉ chữ Hán',
      subOff: 'Tắt phụ đề',
      guestBannerTitle: 'Chế độ xem mẫu',
      guestBannerDesc: 'Đăng nhập để lưu tiến độ xem, tra từ điển AI và làm bài tập trắc nghiệm.',
    },
    feed: {
      watchNow: 'Học ngay',
      recommendedForYou: 'AI gợi ý cho bạn',
      basedOnProfile: 'Theo hồ sơ học',
      preferences: 'Sở thích',
      filterAll: 'Tất cả',
      filterHsk3: 'HSK 3',
      filterBusiness: 'Mục tiêu: Kinh doanh',
      filterTravel: 'Du lịch',
      filterFood: 'Ẩm thực',
      sampleLesson: 'Đang học',
    },
    settings: {
      title: 'Cài Đặt Tài Khoản',
      subtitle: 'Quản lý hồ sơ, bảo mật mật khẩu và tùy chọn học tập',
      tabProfile: 'Hồ sơ cá nhân',
      tabLearning: 'Tùy chọn học tập',
      tabSecurity: 'Đổi mật khẩu',
      fullName: 'Họ và tên',
      email: 'Địa chỉ Email',
      role: 'Vai trò hệ thống',
      surveyCtaTitle: 'Mục tiêu & Lộ trình học tập',
      surveyCtaDesc: 'Cập nhật lại trình độ HSK và các chủ đề bạn quan tâm để trang chủ đề xuất đúng nội dung cần học.',
      retakeSurvey: 'Khảo sát lại',
      saveLearningPrefs: 'Lưu tùy chọn học tập',
      prefSavedSuccess: 'Đã lưu tùy chọn học tập thành công!',
      subModeLabel: 'Chế độ phụ đề mặc định trong video',
      subAllTitle: 'Song ngữ đầy đủ',
      subAllDesc: 'Hán tự + Pinyin + Tiếng Việt',
      subPinyinTitle: 'Trung & Pinyin',
      subPinyinDesc: 'Luyện phản xạ nghĩa',
      subZhTitle: 'Chỉ chữ Hán',
      subZhDesc: 'Thử thách nâng cao',
      audioInteraction: 'Âm thanh & Tương tác',
      autoPronounceTitle: 'Tự động phát âm chuẩn khi bấm vào từ vựng',
      autoPronounceDesc: 'Đọc phát âm tiếng Trung phổ thông (zh-CN) ngay khi tra cứu',
      defaultSpeedTitle: 'Tốc độ phát mặc định',
      defaultSpeedDesc: 'Tốc độ phù hợp khi bắt đầu xem bài học mới',
      currentPass: 'Mật khẩu hiện tại',
      newPass: 'Mật khẩu mới (tối thiểu 8 ký tự)',
      confirmPass: 'Xác nhận mật khẩu mới',
      updatePass: 'Cập nhật mật khẩu mới',
    },
    survey: {
      title: 'Thiết Lập Lộ Trình Học Tập',
      step: 'Bước',
      subtitle: 'Tùy chỉnh nội dung video và lộ trình tiếng Trung phù hợp với bạn',
      welcomeTitle: 'Chào mừng bạn đến với HanFlix!',
      welcomeDesc: 'Chỉ mất khoảng 30 giây để chọn trình độ và mục tiêu của bạn, giúp hệ thống gợi ý các bài học video sát với nhu cầu thực tế nhất.',
      q1Title: 'Trình độ tiếng Trung hiện tại của bạn là gì?',
      q1Desc: 'Hệ thống sẽ sắp xếp các bài học có độ khó từ vựng và ngữ pháp vừa vặn nhất.',
      q2Title: 'Mục tiêu chính khi bạn học tiếng Trung là gì?',
      q2Desc: 'Chọn mục tiêu ưu tiên để hệ thống phân loại bài giảng trên trang chủ của bạn.',
      q3Title: 'Những chủ đề bạn quan tâm nhất khi xem video?',
      q3Desc: 'Chọn các chủ đề bạn muốn học (có thể chọn nhiều).',
      q4Title: 'Thói quen học tập & Chế độ phụ đề',
      q4Desc: 'Thiết lập thời lượng xem video và chế độ hiển thị phù hợp với bạn.',
      habitsTitle: 'Thời lượng dự kiến học mỗi ngày',
      subtitlesTitle: 'Chế độ hiển thị phụ đề mặc định',
      back: 'Quay lại',
      next: 'Tiếp tục',
      skip: 'Bỏ qua lần này',
      finish: 'Lưu & Bắt đầu học',
    },
    streak: {
      title: 'Chuỗi học tập rực lửa',
      subtitle: 'Bạn đã duy trì ngọn lửa học tập 14 ngày liên tiếp. Hãy học một bài ngắn hôm nay để giữ vững thói quen!',
      daysCount: 'ngày streak',
      statusActive: 'Đang duy trì chuỗi',
      statusCompletedToday: 'Đã hoàn thành hôm nay',
      statusPendingToday: 'Chưa học hôm nay',
      todayGoal: 'Mục tiêu hôm nay',
      goalTargetLabel: '15 phút học hoặc 1 bài học ngắn',
      minutesGoal: '10/15 phút',
      studyNowCta: 'Học ngay để giữ chuỗi',
      markCompletedCta: 'Đánh dấu hoàn thành hôm nay',
      completedTodayBadge: 'Tuyệt vời! Chuỗi đã được bảo toàn',
      freezeTitle: 'Khiên bảo vệ chuỗi (Streak Freeze)',
      freezeDesc: 'Tự động bảo vệ ngọn lửa nếu bạn bận rộn 1 ngày.',
      freezeAvailable: '1/2 khiên sẵn sàng',
      freezeEquipCta: 'Trang bị bảo vệ',
      freezeEquippedToast: 'Đã kích hoạt khiên bảo vệ chuỗi!',
      milestoneTitle: 'Cột mốc thói quen',
      longestStreak: 'Chuỗi dài nhất',
      totalDaysLearned: 'Tổng ngày học',
      retentionRate: 'Tỷ lệ duy trì',
      weekdays: {
        mon: 'T2',
        tue: 'T3',
        wed: 'T4',
        thu: 'T5',
        fri: 'T6',
        sat: 'T7',
        sun: 'CN',
      },
      milestones: {
        m7: '7 ngày · Mầm non',
        m14: '14 ngày · Kiên định',
        m30: '30 ngày · Thói quen vàng',
        m60: '60 ngày · Bậc thầy HSK',
        reached: 'Đã đạt',
        current: 'Hiện tại',
        upcoming: 'Sắp tới',
      },
    },
  },

  en: {
    nav: {
      feed: 'Feed',
      lessons: 'Reels',
      saved: 'Saved',
      vocabulary: 'Vocabulary',
      roadmap: 'Roadmap',
      history: 'History',
      exam: 'HSK Exam',
      leaderboard: 'Leaderboard',
      community: 'Community',
      grammar: 'Grammar',
      startReview: 'Start Review',
      settings: 'Settings',
      logout: 'Log Out',
    },
    header: {
      searchPlaceholder: 'Search videos, vocabulary, grammar...',
      searchSuggestions: 'Search Suggestions',
      noResults: 'No matching lessons found',
      streakDays: 'day streak',
      notifications: 'Notifications',
      markAllRead: 'Mark all as read',
      all: 'All',
      unread: 'Unread',
      study: 'Learning',
      system: 'System',
      noNotifications: 'No new notifications',
      noNotificationsSub: 'You are all caught up on recent updates.',
      language: 'Display Language',
      accountSettings: 'Account Settings',
      learningSurvey: 'Learning Survey',
      logout: 'Log Out',
      learner: 'Learner',
      activeStatus: 'Active Account',
    },
    watch: {
      backToFeed: 'Back to Feed',
      topic: 'Topic',
      views: 'views',
      interactiveLesson: 'AI Interactive Lesson',
      save: 'Save',
      saved: 'Saved',
      askAi: 'Ask AI',
      practice: 'Practice Quiz',
      share: 'Share',
      copied: 'Copied',
      copyToast: 'Lesson link copied to clipboard!',
      follow: 'Follow',
      following: 'Following',
      academy: 'HanFlix Chinese Academy',
      academySub: 'New HSK Standard Interactive Curriculum · 14.8K learners',
      infoAndContext: 'Lesson Details & Cultural Context',
      showMore: 'Show more',
      showLess: 'Show less',
      academicHighlights: 'Key Academic Points in Video:',
      transcriptTab: 'Transcript',
      vocabularyTab: 'Vocabulary',
      grammarTab: 'Grammar',
      seekPrompt: 'Click any sentence to pronounce and jump to that video timestamp:',
      listenPronunciation: 'Listen to standard pronunciation',
      saveWordTooltip: 'Save this vocabulary',
      savedWordToast: 'Saved to vocabulary notebook!',
      upNext: 'Up Next',
      recommendedCount: 'recommended',
      subBilingual: 'Subtitles: Bilingual',
      subHanPinyin: 'Subtitles: Han & Pinyin',
      subHanziOnly: 'Subtitles: Hanzi Only',
      subOff: 'Subtitles: Off',
      guestBannerTitle: 'Sample Preview Mode',
      guestBannerDesc: 'Sign in to save your learning progress, use AI lookup, and practice quizzes.',
    },
    feed: {
      watchNow: 'Watch Now',
      recommendedForYou: 'Recommended for You',
      basedOnProfile: 'Based on Profile',
      preferences: 'Preferences',
      filterAll: 'All',
      filterHsk3: 'HSK 3',
      filterBusiness: 'Goal: Business',
      filterTravel: 'Travel',
      filterFood: 'Food & Dining',
      sampleLesson: 'In Progress',
    },
    settings: {
      title: 'Account Settings',
      subtitle: 'Manage profile, security, and study preferences',
      tabProfile: 'Profile',
      tabLearning: 'Learning Preferences',
      tabSecurity: 'Change Password',
      fullName: 'Full Name',
      email: 'Email Address',
      role: 'System Role',
      surveyCtaTitle: 'Goals & Learning Roadmap',
      surveyCtaDesc: 'Update your HSK level and favorite topics to personalize your dashboard recommendations.',
      retakeSurvey: 'Retake Survey',
      saveLearningPrefs: 'Save Preferences',
      prefSavedSuccess: 'Learning preferences saved successfully!',
      subModeLabel: 'Default Subtitle Display Mode',
      subAllTitle: 'Full Bilingual',
      subAllDesc: 'Chinese + Pinyin + Translation',
      subPinyinTitle: 'Chinese & Pinyin',
      subPinyinDesc: 'Train natural comprehension',
      subZhTitle: 'Characters Only',
      subZhDesc: 'Advanced reading challenge',
      audioInteraction: 'Audio & Interaction',
      autoPronounceTitle: 'Auto-pronounce standard Chinese on click',
      autoPronounceDesc: 'Play Mandarin audio (zh-CN) immediately upon word lookup',
      defaultSpeedTitle: 'Default Playback Speed',
      defaultSpeedDesc: 'Recommended starting speed for new lessons',
      currentPass: 'Current Password',
      newPass: 'New Password (min 8 characters)',
      confirmPass: 'Confirm New Password',
      updatePass: 'Update Password',
    },
    survey: {
      title: 'Set Up Learning Roadmap',
      step: 'Step',
      subtitle: 'Tailor video content and curriculum to your proficiency and interests',
      welcomeTitle: 'Welcome to HanFlix!',
      welcomeDesc: 'Take 30 seconds to choose your proficiency level and goals so we can recommend the most practical video lessons.',
      q1Title: 'What is your current Chinese proficiency level?',
      q1Desc: 'We will curate videos with vocabulary and grammar matched to your current stage.',
      q2Title: 'What is your primary goal for learning Chinese?',
      q2Desc: 'Pick your top priority so we can categorize lessons on your home dashboard.',
      q3Title: 'Which topics interest you most when watching videos?',
      q3Desc: 'Select topics you want to learn (you can choose multiple).',
      q4Title: 'Study Habits & Subtitle Preferences',
      q4Desc: 'Set your daily target time and preferred subtitle display.',
      habitsTitle: 'Target study time per day',
      subtitlesTitle: 'Default subtitle mode',
      back: 'Back',
      next: 'Continue',
      skip: 'Skip for now',
      finish: 'Save & Start Learning',
    },
    streak: {
      title: 'Learning Streak on Fire!',
      subtitle: 'You have maintained your study streak for 14 consecutive days. Complete a quick lesson today to keep the fire burning!',
      daysCount: 'day streak',
      statusActive: 'Streak Active',
      statusCompletedToday: 'Completed for Today',
      statusPendingToday: 'Pending Today',
      todayGoal: "Today's Target",
      goalTargetLabel: '15 mins of study or 1 video lesson',
      minutesGoal: '10/15 mins',
      studyNowCta: 'Study Now to Keep Streak',
      markCompletedCta: 'Mark Completed for Today',
      completedTodayBadge: 'Awesome! Streak secured for today',
      freezeTitle: 'Streak Freeze Shield',
      freezeDesc: 'Automatically protects your flame if you miss a busy day.',
      freezeAvailable: '1/2 shields available',
      freezeEquipCta: 'Equip Shield',
      freezeEquippedToast: 'Streak freeze shield activated!',
      milestoneTitle: 'Habit Milestones',
      longestStreak: 'Longest Streak',
      totalDaysLearned: 'Total Days',
      retentionRate: 'Retention Rate',
      weekdays: {
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',
        sat: 'Sat',
        sun: 'Sun',
      },
      milestones: {
        m7: '7 Days · Starter',
        m14: '14 Days · Persistent',
        m30: '30 Days · Golden Habit',
        m60: '60 Days · HSK Master',
        reached: 'Unlocked',
        current: 'Current',
        upcoming: 'Upcoming',
      },
    },
  },

  zh: {
    nav: {
      feed: '动态',
      lessons: 'Reels',
      saved: '收藏库',
      vocabulary: '生词本',
      roadmap: '学习路线',
      history: '学习记录',
      exam: 'HSK 考试',
      leaderboard: '排行榜',
      community: '学习社区',
      grammar: '语法',
      startReview: '开始复习',
      settings: '设置',
      logout: '退出登录',
    },
    header: {
      searchPlaceholder: '搜索视频、生词、语法...',
      searchSuggestions: '搜索建议',
      noResults: '未找到匹配的课程',
      streakDays: '天连续打卡',
      notifications: '通知中心',
      markAllRead: '全部标记为已读',
      all: '全部',
      unread: '未读',
      study: '学习提醒',
      system: '系统通知',
      noNotifications: '暂无新通知',
      noNotificationsSub: '您已查看所有最新动态。',
      language: '界面语言',
      accountSettings: '账户设置',
      learningSurvey: '学习意向调研',
      logout: '退出登录',
      learner: '学员',
      activeStatus: '账户正常',
    },
    watch: {
      backToFeed: '返回动态',
      topic: '主题',
      views: '次观看',
      interactiveLesson: 'AI 互动课程',
      save: '收藏课程',
      saved: '已收藏',
      askAi: '向AI提问',
      practice: '随堂测验',
      share: '分享',
      copied: '已复制',
      copyToast: '课程链接已复制到剪贴板！',
      follow: '关注',
      following: '已关注',
      academy: 'HanFlix 中文学院',
      academySub: '新 HSK 标准沉浸式互动教程 · 1.48 万学员',
      infoAndContext: '课程详情与文化背景',
      showMore: '展开更多',
      showLess: '收起',
      academicHighlights: '本课核心学习要点：',
      transcriptTab: '剧本对白',
      vocabularyTab: '核心生词',
      grammarTab: '重点语法',
      seekPrompt: '点击句子即可发音并跳转至该时间节点：',
      listenPronunciation: '听标准发音',
      saveWordTooltip: '收藏该生词',
      savedWordToast: '已添加到生词本！',
      upNext: '接下来播放',
      recommendedCount: '个推荐视频',
      subBilingual: '字幕：双语对照',
      subHanPinyin: '字幕：汉字 + 拼音',
      subHanziOnly: '字幕：仅汉字',
      subOff: '关闭字幕',
      guestBannerTitle: '样片试看模式',
      guestBannerDesc: '登录账户即可保存学习进度、使用 AI 释义并参加随堂练习。',
    },
    feed: {
      watchNow: '立即学习',
      recommendedForYou: '为您个性化推荐',
      basedOnProfile: '根据学习档案',
      preferences: '学习偏好',
      filterAll: '全部',
      filterHsk3: 'HSK 3级',
      filterBusiness: '目标：商务中文',
      filterTravel: '旅游出行',
      filterFood: '美食餐饮',
      sampleLesson: '正在学习',
    },
    settings: {
      title: '账户设置',
      subtitle: '管理个人资料、安全密码及学习偏好',
      tabProfile: '个人资料',
      tabLearning: '学习偏好',
      tabSecurity: '修改密码',
      fullName: '学员姓名',
      email: '电子邮箱',
      role: '系统角色',
      surveyCtaTitle: '学习目标与定制路线',
      surveyCtaDesc: '重新设定您的 HSK 水平及偏好主题，主页将据此更新专属推荐内容。',
      retakeSurvey: '重新调研',
      saveLearningPrefs: '保存学习偏好',
      prefSavedSuccess: '学习偏好设置已成功保存！',
      subModeLabel: '视频默认字幕显示模式',
      subAllTitle: '双语对照',
      subAllDesc: '汉字 + 拼音 + 翻译',
      subPinyinTitle: '汉字与拼音',
      subPinyinDesc: '锻炼语感与直接反应',
      subZhTitle: '纯汉字显示',
      subZhDesc: '进阶深度阅读挑战',
      audioInteraction: '声音与交互',
      autoPronounceTitle: '点击生词时自动播放标准发音',
      autoPronounceDesc: '查词时立即朗读标准普通话 (zh-CN) 发音',
      defaultSpeedTitle: '默认播放倍速',
      defaultSpeedDesc: '新课视频建议起始播放速率',
      currentPass: '当前密码',
      newPass: '新密码（至少8位字符）',
      confirmPass: '确认新密码',
      updatePass: '确认修改密码',
    },
    survey: {
      title: '设定学习路线与目标',
      step: '第',
      subtitle: '定制专属于您的中文视频课程与学习进度',
      welcomeTitle: '欢迎来到 HanFlix！',
      welcomeDesc: '仅需 30 秒选择您的中文水平与兴趣目标，系统将为您精选最契合实际应用场景的视频教程。',
      q1Title: '您目前的中文水平大约是？',
      q1Desc: '我们将精选词汇难度与语法结构最贴合您现阶段水平的视频。',
      q2Title: '您学习中文的主要目标是？',
      q2Desc: '选择首要目标，便于系统为您在首页呈现分类课程。',
      q3Title: '您看视频时最感兴趣的主题有哪些？',
      q3Desc: '选择您渴望学习的主题（可多选）。',
      q4Title: '学习习惯与字幕显示',
      q4Desc: '设置每日建议学习时长与最适合您的字幕模式。',
      habitsTitle: '每日计划学习时长',
      subtitlesTitle: '默认字幕显示模式',
      back: '上一步',
      next: '下一步',
      skip: '暂跳过',
      finish: '保存并开始学习',
    },
    streak: {
      title: '连续打卡火热进行中！',
      subtitle: '您已连续打卡学习 14 天。今天完成一个简短课程，继续保持火热势头！',
      daysCount: '天连续打卡',
      statusActive: '打卡进行中',
      statusCompletedToday: '今日已完成打卡',
      statusPendingToday: '今日待完成',
      todayGoal: '今日目标',
      goalTargetLabel: '学习 15 分钟或完成 1 堂视频课',
      minutesGoal: '10/15 分钟',
      studyNowCta: '立即学习保持打卡',
      markCompletedCta: '打卡标记今日完成',
      completedTodayBadge: '太棒了！今日打卡已成功锁定',
      freezeTitle: '打卡保护盾 (Streak Freeze)',
      freezeDesc: '若某天繁忙遗漏，系统将自动使用护盾保护连续天数。',
      freezeAvailable: '1/2 个护盾可用',
      freezeEquipCta: '装备护盾',
      freezeEquippedToast: '打卡保护盾已成功生效！',
      milestoneTitle: '习惯里程碑',
      longestStreak: '最长连续',
      totalDaysLearned: '累计学习',
      retentionRate: '坚持率',
      weekdays: {
        mon: '周一',
        tue: '周二',
        wed: '周三',
        thu: '周四',
        fri: '周五',
        sat: '周六',
        sun: '周日',
      },
      milestones: {
        m7: '7 天 · 初露锋芒',
        m14: '14 天 · 坚持不懈',
        m30: '30 天 · 黄金习惯',
        m60: '60 天 · HSK 达人',
        reached: '已解锁',
        current: '当前',
        upcoming: '即将解锁',
      },
    },
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'vi',
  setLang: () => {},
  t: TRANSLATIONS.vi,
});

export function LanguageProvider({
  children,
  initialLang = 'vi',
  onLangChange,
}: {
  children: ReactNode;
  initialLang?: Language;
  onLangChange?: (lang: Language) => void;
}) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hanflix_language');
      if (saved === 'vi' || saved === 'en' || saved === 'zh') {
        return saved;
      }
    }
    return initialLang;
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hanflix_language', newLang);
    }
    if (onLangChange) {
      onLangChange(newLang);
    }
  };

  useEffect(() => {
    if (initialLang && initialLang !== lang) {
      setLangState(initialLang);
    }
  }, [initialLang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
