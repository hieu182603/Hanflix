export interface UserLearningProfile {
  hskLevel: number; // 1 to 9
  goal: string; // "business" | "travel" | "daily" | "hsk"
  topics: string[]; // ["food", "travel", "shopping", "entertainment", "business", "daily-life"]
  dailyMinutes: number;
  preferredDuration: string; // "1-3" | "3-5"
  subtitleDefaults: { zh: boolean; pinyin: boolean; vi: boolean };
  defaultSpeed: number;
  uiLanguage: string;
  surveyVersion?: number;
  currentHskSource?: string;
  targetHsk?: number;
  focusSkills?: string[];
  studyDaysPerWeek?: number;
  subtitlePreference?: string;
}

export interface User {
  id: string;
  role: 'user' | 'admin';
  status: 'active' | 'locked';
  name: string;
  email: string;
  totalXP?: number;
  avatarAsset?: string | null;
  avatarUrl?: string | null;
  googleAvatarUrl?: string | null;
  avatarType?: 'generated' | 'custom' | null;
  avatarConfig?: any;
  avatarPublicId?: string | null;
  learningProfile?: UserLearningProfile | null;
  premiumExpiresAt?: Date | string | null;
  subscriptionTier?: 'free' | 'premium';
}

export interface UserProfile {
  id?: string;
  name: string;
  role?: string;
  avatar: string;
  avatarConfig?: any;
  level: string;
  hskProgress: number;
  hskLevel: string;
  streakDays: number;
  targetGoal: string;
  interests: string[];
  totalXP?: number;
  subtitleMode?: 'all' | 'zh-pinyin' | 'zh';
}

export interface Topic {
  id: string;
  labelVi: string;
}

export interface CueToken {
  text: string;
  wordId: string | null;
}

export interface Cue {
  id: string;
  start: number;
  end: number;
  zh: string;
  pinyin: string;
  vi: string;
  tokens: CueToken[];
}

export interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  partOfSpeech: string;
  hskLevel?: number;
  audioAsset?: string | null;
  sourceRefs: Array<{ lessonId: string; cueId: string }>;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'fill-blank';
  promptVi: string;
  options?: Array<{ id: string; text: string }>;
  correctOptionId?: string;
  acceptedAnswers?: string[];
  normalization?: string;
  explanationVi: string;
  relatedWordIds: string[];
  cueId: string;
}

export interface Quiz {
  id: string;
  lessonId: string;
  status: 'published' | 'draft';
  questions: QuizQuestion[];
}

export interface Lesson {
  id: string;
  titleVi: string;
  titleZh: string;
  pinyin: string;
  descriptionVi: string;
  hsk: number;
  topics: string[];
  goalTags: string[];
  durationSeconds: number;
  status: 'published' | 'draft' | 'processing' | 'hidden';
  publishedRevision: number;
  mediaMode: 'simulation' | 'real';
  mediaAsset?: string | null;
  thumbnailAsset?: string | null;
  thumbnailBrief?: string;
  cuesRef?: string | null;
  glossaryIds: string[];
  quizId?: string | null;
  contentReady: boolean;
}

export interface VideoLesson {
  id: string;
  title: string;
  chineseTitle: string;
  pinyinTitle?: string;
  subtitle: string;
  category: string;
  hskLevel: string;
  status?: 'Đang học' | 'Ôn lại' | 'Chưa học';
  duration: string;
  viewCount: string;
  thumbnail: string;
  recommendationReason?: string;
  tags: string[];
  description?: string;
  vocabularyList?: Array<{
    word: string;
    pinyin: string;
    type: string;
    meaning: string;
    example: string;
  }>;
  transcript?: Array<{
    time: string;
    chinese: string;
    pinyin: string;
    vietnamese: string;
  }>;
}

export interface SavedWordSRS {
  dueAt: number;
  intervalDays: number;
  repetitions: number;
  lastRating?: 'again' | 'hard' | 'good' | 'easy' | null;
}

export interface SavedWord {
  userId: string;
  wordId: string;
  sourceRefs: Array<{ lessonId: string; cueId: string }>;
  srs: SavedWordSRS;
  savedAt: number;
}

export interface SavedLesson {
  userId: string;
  lessonId: string;
  savedAt: number;
}

export interface LessonProgress {
  userId: string;
  lessonId: string;
  lastPositionSeconds: number;
  watchedRanges: Array<[number, number]>;
  completed: boolean;
  activeStudySeconds: number;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  lessonId: string;
  submittedAt: number;
  score: number;
  correctCount: number;
  totalCount: number;
  answers: Record<string, string>;
}

// Guest up-next lessons used in WatchView when in guest preview mode
export const RECOMMENDATION_LESSONS: VideoLesson[] = [
  {
    id: "17",
    title: "Gọi món ở nhà hàng",
    chineseTitle: "在饭馆点菜",
    pinyinTitle: "Zài fànguǎn diǎncài",
    subtitle: "Gọi món đặc sản vịt quay Bắc Kinh, gọi đồ uống và dặn khẩu vị với phục vụ.",
    category: "Ẩm thực",
    hskLevel: "HSK 3",
    status: "Đang học",
    duration: "2:47",
    viewCount: "6,9N",
    thumbnail: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=600&fit=crop",
    tags: ["HSK 3", "Ẩm thực"],
    description: "Bài học giúp bạn tự tin bước vào bất kỳ nhà hàng Trung Quốc nào: từ cách gọi nhân viên, đọc thực đơn, hỏi món đặc sản, dặn không cay/bớt giấm đến thanh toán hóa đơn.",
    vocabularyList: [
      { word: "点菜", pinyin: "diǎn cài", type: "động từ", meaning: "Gọi món", example: "服务员，我们要点菜。(Phục vụ ơi, chúng tôi muốn gọi món.)" },
      { word: "烤鸭", pinyin: "kǎoyā", type: "danh từ", meaning: "Vịt quay", example: "这里的大观北京烤鸭非常有名。(Vịt quay Bắc Kinh ở đây rất nổi tiếng.)" },
      { word: "忌口", pinyin: "jìkǒu", type: "động từ", meaning: "Kiêng ăn / Khẩu vị đặc biệt", example: "请问您有什么忌口吗？(Xin hỏi bạn có kiêng ăn gì không?)" },
      { word: "微辣", pinyin: "wēilà", type: "tính từ", meaning: "Ít cay / Cay nhẹ", example: "这个菜请做微辣。(Món này xin làm cay nhẹ thôi.)" },
      { word: "买单", pinyin: "mǎidān", type: "động từ", meaning: "Tính tiền / Thanh toán", example: "服务员，买单！(Phục vụ ơi, tính tiền!)" }
    ],
    transcript: [
      { time: "0:02", chinese: "服务员，请拿一下菜单。", pinyin: "Fúwùyuán, qǐng ná yíxià càidān.", vietnamese: "Phục vụ ơi, cho xin cái menu." },
      { time: "0:08", chinese: "请问你们有什么招牌菜？", pinyin: "Qǐngwèn nǐmen yǒu shénme zhāopaicài?", vietnamese: "Xin hỏi nhà hàng mình có món đặc sản nào?" },
      { time: "0:15", chinese: "给我来一份北京烤鸭，做微辣的。", pinyin: "Gěi wǒ lái yí fèn Běijīng kǎoyā, zuò wēilà de.", vietnamese: "Cho tôi một phần vịt quay Bắc Kinh, làm cay nhẹ thôi." },
      { time: "0:22", chinese: "好的，请稍等，马上就来。", pinyin: "Hǎo de, qǐng shāo děng, mǎshàng jiù lái.", vietnamese: "Vâng ạ, xin chờ một chút, món sẽ lên ngay." }
    ]
  },
  {
    id: "18",
    title: "Rủ bạn đi xem phim",
    chineseTitle: "一起来看电影吧",
    pinyinTitle: "Yìqǐ lái kàn diànyǐng ba",
    subtitle: "Hẹn giờ giấc, chọn chỗ ngồi rạp chiếu và mua bắp nước.",
    category: "Phim ảnh & âm nhạc",
    hskLevel: "HSK 3",
    status: "Chưa học",
    duration: "2:29",
    viewCount: "5,1N",
    thumbnail: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&h=300&fit=crop",
    recommendationReason: "✨ Đúng trình độ HSK 3",
    tags: ["HSK 3", "Giải trí"]
  },
  {
    id: "19",
    title: "Đặt phòng khách sạn",
    chineseTitle: "预订酒店",
    pinyinTitle: "Yùdìng jiǔdiàn",
    subtitle: "Cách check-in, yêu cầu phòng hướng biển và thủ tục nhận chìa khóa.",
    category: "Du lịch",
    hskLevel: "HSK 3",
    duration: "2:20",
    viewCount: "3,4N",
    thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop",
    tags: ["HSK 3", "Du lịch"],
    description: "Hướng dẫn nhận phòng tại khách sạn, xuất trình hộ chiếu, đặt cọc và hỏi mật khẩu Wi-Fi bằng tiếng Trung.",
    vocabularyList: [
      { word: "预订", pinyin: "yùdìng", type: "động từ", meaning: "Đặt trước", example: "我已经预订了一间大床房。(Tôi đã đặt trước một phòng giường lớn.)" },
      { word: "入住", pinyin: "rùzhù", type: "động từ", meaning: "Nhận phòng (Check-in)", example: "我想办理入住手续。(Tôi muốn làm thủ tục nhận phòng.)" },
      { word: "押金", pinyin: "yājīn", type: "danh từ", meaning: "Tiền đặt cọc", example: "入住需要交五百块押金。(Check-in cần nộp 500 tệ tiền cọc.)" }
    ],
    transcript: [
      { time: "0:03", chinese: "你好，我在网上预订了房间。", pinyin: "Nǐ hǎo, wǒ zài wǎngshang yùdìng le fángjiān.", vietnamese: "Xin chào, tôi đã đặt phòng trên mạng." },
      { time: "0:10", chinese: "请出示一下您的护照。", pinyin: "Qǐng chūshì yíxià nín de hùzhào.", vietnamese: "Xin vui lòng xuất trình hộ chiếu của bạn." }
    ]
  },
  {
    id: "20",
    title: "Mặc cả khi mua sắm ở chợ",
    chineseTitle: "在市场砍价",
    pinyinTitle: "Zài shìchǎng kǎnjià",
    subtitle: "Kỹ năng trả giá, hỏi giảm giá và thanh toán bằng WeChat Pay / Alipay.",
    category: "Mua sắm",
    hskLevel: "HSK 3",
    status: "Ôn lại",
    duration: "3:15",
    viewCount: "4,2N",
    thumbnail: "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=500&h=300&fit=crop",
    recommendationReason: "✨ Ôn lại bài đã học để nhớ lâu hơn",
    tags: ["HSK 3", "Mua sắm"]
  }
];

// Sample marketing lessons for LandingPage preview & Guest route
export const SAMPLE_LESSONS: Lesson[] = [
  {
    id: "17",
    titleVi: "Gọi món ở nhà hàng",
    titleZh: "在饭馆点菜",
    pinyin: "Zài fànguǎn diǎncài",
    descriptionVi: "Gọi món, hỏi món vịt quay và thanh toán tại nhà hàng.",
    hsk: 3,
    topics: ["food"],
    goalTags: ["daily", "travel"],
    durationSeconds: 167,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    mediaAsset: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=600&fit=crop",
    thumbnailAsset: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=350&fit=crop",
    thumbnailBrief: "Tình huống gọi món tại nhà hàng Trung Quốc, món vịt quay và bàn ăn; tỷ lệ 16:9.",
    cuesRef: "lesson-17-cues",
    glossaryIds: ["word-fuwuyuan", "word-caidan", "word-diancai", "word-kaoya", "word-maidan"],
    quizId: "quiz-17",
    contentReady: true
  },
  {
    id: "18",
    titleVi: "Rủ bạn đi xem phim",
    titleZh: "一起去看电影吧",
    pinyin: "Yìqǐ qù kàn diànyǐng ba",
    descriptionVi: "Rủ bạn, chọn giờ chiếu và mua vé xem phim.",
    hsk: 3,
    topics: ["entertainment"],
    goalTags: ["daily"],
    durationSeconds: 149,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  },
  {
    id: "19",
    titleVi: "Đặt phòng khách sạn",
    titleZh: "预订酒店",
    pinyin: "Yùdìng jiǔdiàn",
    descriptionVi: "Đặt phòng, nhận phòng và thủ tục nhận chìa khóa.",
    hsk: 3,
    topics: ["travel"],
    goalTags: ["travel"],
    durationSeconds: 140,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  },
  {
    id: "20",
    titleVi: "Mặc cả khi mua sắm ở chợ",
    titleZh: "在市场砍价",
    pinyin: "Zài shìchǎng kǎnjià",
    descriptionVi: "Hỏi giá, mặc cả và thanh toán qua mã QR.",
    hsk: 3,
    topics: ["shopping"],
    goalTags: ["daily"],
    durationSeconds: 195,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  },
  {
    id: "21",
    titleVi: "Giới thiệu bản thân khi phỏng vấn",
    titleZh: "面试自我介绍",
    pinyin: "Miànshì zìwǒ jièshào",
    descriptionVi: "Tự giới thiệu kinh nghiệm làm việc và điểm mạnh trong công việc.",
    hsk: 4,
    topics: ["business"],
    goalTags: ["business"],
    durationSeconds: 245,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  },
  {
    id: "22",
    titleVi: "Viết email trao đổi công việc",
    titleZh: "商务邮件沟通",
    pinyin: "Shāngwù yóujiàn gōutōng",
    descriptionVi: "Quy chuẩn viết email công việc trang trọng với đối tác.",
    hsk: 4,
    topics: ["business"],
    goalTags: ["business"],
    durationSeconds: 210,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  },
  {
    id: "23",
    titleVi: "Hỏi đường và bắt taxi",
    titleZh: "问路与打车",
    pinyin: "Wènlù yǔ dǎchē",
    descriptionVi: "Hỏi đường đến ga tàu điện ngầm và chỉ đường cho tài xế taxi.",
    hsk: 2,
    topics: ["travel"],
    goalTags: ["travel"],
    durationSeconds: 125,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1508873696983-2df515122519?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  },
  {
    id: "24",
    titleVi: "Chào hỏi và giới thiệu tên",
    titleZh: "打招呼和介绍名字",
    pinyin: "Dǎ zhāohu hé jièshào míngzi",
    descriptionVi: "Bắt đầu một cuộc gặp và giới thiệu tên của mình.",
    hsk: 1,
    topics: ["daily-life"],
    goalTags: ["daily"],
    durationSeconds: 95,
    status: "published",
    publishedRevision: 1,
    mediaMode: "simulation",
    thumbnailAsset: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=350&fit=crop",
    cuesRef: null,
    glossaryIds: [],
    quizId: null,
    contentReady: false
  }
];

// Format Seconds to MM:SS
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
