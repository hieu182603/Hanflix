export interface UserLearningProfile {
  hskLevel: number; // 1 to 9
  goal: string; // "business" | "travel" | "daily" | "hsk"
  topics: string[]; // ["food", "travel", "shopping", "entertainment", "business", "daily-life"]
  dailyMinutes: number;
  preferredDuration: string; // "1-3" | "3-5"
  subtitleDefaults: { zh: boolean; pinyin: boolean; vi: boolean };
  defaultSpeed: number;
  uiLanguage: string;
  surveyVersion?: number; // Set when onboarding survey is completed
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
  avatarAsset?: string | null;
  avatarUrl?: string | null;
  googleAvatarUrl?: string | null;
  avatarType?: 'generated' | 'custom' | null;
  avatarConfig?: any;
  avatarPublicId?: string | null;
  learningProfile?: UserLearningProfile | null;
}


export interface UserProfile {
  id?: string;
  name: string;
  avatar: string;
  avatarConfig?: any;
  level: string;
  hskProgress: number;
  hskLevel: string;
  streakDays: number;
  targetGoal: string;
  interests: string[];
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

// Initial Data derived from HanFlix_04_Du_Lieu_Mau.json
export const TOPICS: Topic[] = [
  { id: "food", labelVi: "Ẩm thực" },
  { id: "travel", labelVi: "Du lịch" },
  { id: "shopping", labelVi: "Mua sắm" },
  { id: "entertainment", labelVi: "Phim ảnh và âm nhạc" },
  { id: "business", labelVi: "Kinh doanh" },
  { id: "daily-life", labelVi: "Đời sống" }
];

export const INITIAL_USERS: User[] = [
  {
    id: "user-minh-anh",
    role: "user",
    status: "active",
    name: "Nguyễn Minh Anh",
    email: "minhanh@example.test",
    avatarAsset: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces",
    learningProfile: {
      hskLevel: 3,
      goal: "business",
      topics: ["travel", "food"],
      dailyMinutes: 10,
      preferredDuration: "1-3",
      subtitleDefaults: { zh: true, pinyin: true, vi: true },
      defaultSpeed: 1,
      uiLanguage: "vi"
    }
  },
  {
    id: "user-bao-ngoc",
    role: "user",
    status: "locked",
    name: "Trần Bảo Ngọc",
    email: "baongoc@example.test",
    avatarAsset: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=faces",
    learningProfile: {
      hskLevel: 2,
      goal: "travel",
      topics: ["travel", "shopping"],
      dailyMinutes: 15,
      preferredDuration: "3-5",
      subtitleDefaults: { zh: true, pinyin: true, vi: true },
      defaultSpeed: 0.75,
      uiLanguage: "vi"
    }
  },
  {
    id: "admin-thu-ha",
    role: "admin",
    status: "active",
    name: "Lê Thu Hà",
    email: "admin@example.test",
    avatarAsset: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=faces",
    learningProfile: null
  }
];

export const HERO_LESSON: VideoLesson = {
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
};

export const RIGHT_RAIL_LESSON: VideoLesson = {
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
};

export const RECOMMENDATION_LESSONS: VideoLesson[] = [
  HERO_LESSON,
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
  RIGHT_RAIL_LESSON,
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
  },
  {
    id: "21",
    title: "Giới thiệu bản thân trong phỏng vấn",
    chineseTitle: "面试中的自我介绍",
    pinyinTitle: "Miànshì zhōng de zìwǒ jièshào",
    subtitle: "Tự giới thiệu bản thân, trình bày kinh nghiệm làm việc và kỳ vọng lương.",
    category: "Kinh doanh",
    hskLevel: "HSK 3",
    status: "Chưa học",
    duration: "4:05",
    viewCount: "8,7N",
    thumbnail: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=300&fit=crop",
    recommendationReason: "✨ Khớp mục tiêu Kinh doanh của bạn",
    tags: ["HSK 3", "Kinh doanh"]
  },
  {
    id: "22",
    title: "Gửi email cho đối tác",
    chineseTitle: "给合作伙伴发邮件",
    pinyinTitle: "Gěi hézuò huǒbàn fā yóujiàn",
    subtitle: "Mẫu câu chào hỏi trang trọng, xác nhận lịch họp và cảm ơn đối tác.",
    category: "Kinh doanh",
    hskLevel: "HSK 3",
    status: "Chưa học",
    duration: "3:30",
    viewCount: "7,1N",
    thumbnail: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=500&h=300&fit=crop",
    recommendationReason: "✨ Phù hợp hồ sơ Học tiếng Trung Thương mại",
    tags: ["HSK 3", "Kinh doanh"]
  },
  {
    id: "23",
    title: "Hỏi đường đến ga tàu",
    chineseTitle: "问去车站的路",
    pinyinTitle: "Wèn qù chēzhàn de lù",
    subtitle: "Hỏi vị trí ga tàu và hiểu chỉ dẫn đường cơ bản.",
    category: "Du lịch",
    hskLevel: "HSK 2",
    status: "Chưa học",
    duration: "2:05",
    viewCount: "5,8N",
    thumbnail: "https://images.unsplash.com/photo-1508873696983-2df515122519?w=500&h=300&fit=crop",
    recommendationReason: "✨ Đề xuất theo sở thích Du lịch",
    tags: ["HSK 2", "Di chuyển"]
  },
  {
    id: "24",
    title: "Chào hỏi và giới thiệu tên",
    chineseTitle: "打招呼和介绍名字",
    pinyinTitle: "Dǎ zhāohu hé jièshào míngzi",
    subtitle: "Bắt đầu một cuộc gặp và giới thiệu tên của mình.",
    category: "Đời sống",
    hskLevel: "HSK 1",
    status: "Chưa học",
    duration: "1:35",
    viewCount: "3,9N",
    thumbnail: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&h=300&fit=crop",
    recommendationReason: "✨ Bài học nhập môn cơ bản",
    tags: ["HSK 1", "Giao tiếp"]
  }
];

export const QUICK_AI_PROMPTS = [
  "Giải thích ngữ pháp câu trong bài",
  "Tạo 5 câu luyện tập với từ vừa học",
  "Kiểm tra phát âm giọng chuẩn Bắc Kinh",
  "Gợi ý bài tiếp theo dựa trên tiến độ"
];

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
    descriptionVi: "Hỏi loại phòng, thời gian lưu trú và làm thủ tục nhận phòng.",
    hsk: 3,
    topics: ["travel"],
    goalTags: ["travel", "business"],
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
    descriptionVi: "Hỏi giá và đề nghị giảm giá khi mua hàng.",
    hsk: 3,
    topics: ["shopping"],
    goalTags: ["daily", "travel"],
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
    titleVi: "Giới thiệu bản thân trong buổi phỏng vấn",
    titleZh: "面试中的自我介绍",
    pinyin: "Miànshì zhōng de zìwǒ jièshào",
    descriptionVi: "Giới thiệu kinh nghiệm và mục tiêu công việc.",
    hsk: 3,
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
    titleVi: "Gửi email cho đối tác",
    titleZh: "给合作伙伴发邮件",
    pinyin: "Gěi hézuò huǒbàn fā yóujiàn",
    descriptionVi: "Viết lời chào và đề nghị lịch trao đổi công việc.",
    hsk: 3,
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
    titleVi: "Hỏi đường đến ga tàu",
    titleZh: "问去车站的路",
    pinyin: "Wèn qù chēzhàn de lù",
    descriptionVi: "Hỏi vị trí ga tàu và hiểu chỉ dẫn đường cơ bản.",
    hsk: 2,
    topics: ["travel"],
    goalTags: ["travel", "daily"],
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

export const SAMPLE_WORDS: Word[] = [
  { id: "word-fuwuyuan", hanzi: "服务员", pinyin: "fúwùyuán", meaningVi: "nhân viên phục vụ", partOfSpeech: "danh từ", sourceRefs: [{ lessonId: "17", cueId: "cue-17-1" }] },
  { id: "word-caidan", hanzi: "菜单", pinyin: "càidān", meaningVi: "thực đơn", partOfSpeech: "danh từ", sourceRefs: [{ lessonId: "17", cueId: "cue-17-1" }] },
  { id: "word-diancai", hanzi: "点菜", pinyin: "diǎncài", meaningVi: "gọi món", partOfSpeech: "động từ", sourceRefs: [{ lessonId: "17", cueId: "cue-17-2" }] },
  { id: "word-kaoya", hanzi: "烤鸭", pinyin: "kǎoyā", meaningVi: "vịt quay", partOfSpeech: "danh từ", sourceRefs: [{ lessonId: "17", cueId: "cue-17-3" }] },
  { id: "word-maidan", hanzi: "买单", pinyin: "mǎidān", meaningVi: "thanh toán", partOfSpeech: "động từ", sourceRefs: [{ lessonId: "17", cueId: "cue-17-7" }] }
];

export const SAMPLE_CUES: Cue[] = [
  {
    id: "cue-17-1", start: 0, end: 12,
    zh: "服务员，请给我菜单。",
    pinyin: "Fúwùyuán, qǐng gěi wǒ càidān.",
    vi: "Phục vụ ơi, vui lòng cho tôi thực đơn.",
    tokens: [
      { text: "服务员", wordId: "word-fuwuyuan" },
      { text: "，请给我", wordId: null },
      { text: "菜单", wordId: "word-caidan" },
      { text: "。", wordId: null }
    ]
  },
  {
    id: "cue-17-2", start: 12, end: 25,
    zh: "我们要点菜。",
    pinyin: "Wǒmen yào diǎncài.",
    vi: "Chúng tôi muốn gọi món.",
    tokens: [
      { text: "我们要", wordId: null },
      { text: "点菜", wordId: "word-diancai" },
      { text: "。", wordId: null }
    ]
  },
  {
    id: "cue-17-3", start: 25, end: 40,
    zh: "这里的烤鸭怎么样？",
    pinyin: "Zhèlǐ de kǎoyā zěnmeyàng?",
    vi: "Vịt quay ở đây thế nào?",
    tokens: [
      { text: "这里的", wordId: null },
      { text: "烤鸭", wordId: "word-kaoya" },
      { text: "怎么样？", wordId: null }
    ]
  },
  {
    id: "cue-17-4", start: 40, end: 57,
    zh: "烤鸭很好吃。",
    pinyin: "Kǎoyā hěn hǎochī.",
    vi: "Vịt quay rất ngon.",
    tokens: [
      { text: "烤鸭", wordId: "word-kaoya" },
      { text: "很好吃。", wordId: null }
    ]
  },
  {
    id: "cue-17-5", start: 57, end: 80,
    zh: "那我们要一份烤鸭。",
    pinyin: "Nà wǒmen yào yí fèn kǎoyā.",
    vi: "Vậy chúng tôi lấy một phần vịt quay.",
    tokens: [
      { text: "那我们要一份", wordId: null },
      { text: "烤鸭", wordId: "word-kaoya" },
      { text: "。", wordId: null }
    ]
  },
  {
    id: "cue-17-6", start: 80, end: 106,
    zh: "请再给我们两杯水。",
    pinyin: "Qǐng zài gěi wǒmen liǎng bēi shuǐ.",
    vi: "Vui lòng cho chúng tôi thêm hai cốc nước.",
    tokens: [{ text: "请再给我们两杯水。", wordId: null }]
  },
  {
    id: "cue-17-7", start: 106, end: 138,
    zh: "服务员，我们要买单。",
    pinyin: "Fúwùyuán, wǒmen yào mǎidān.",
    vi: "Phục vụ ơi, chúng tôi muốn thanh toán.",
    tokens: [
      { text: "服务员", wordId: "word-fuwuyuan" },
      { text: "，我们要", wordId: null },
      { text: "买单", wordId: "word-maidan" },
      { text: "。", wordId: null }
    ]
  },
  {
    id: "cue-17-8", start: 138, end: 167,
    zh: "谢谢，下次再来。",
    pinyin: "Xièxie, xià cì zài lái.",
    vi: "Cảm ơn, lần sau lại đến nhé.",
    tokens: [{ text: "谢谢，下次再来。", wordId: null }]
  }
];

export const SAMPLE_QUIZ: Quiz = {
  id: "quiz-17",
  lessonId: "17",
  status: "published",
  questions: [
    {
      id: "q17-1", type: "multiple-choice", promptVi: "点菜 có nghĩa là gì?",
      options: [
        { id: "a", text: "Gọi món" },
        { id: "b", text: "Thanh toán" },
        { id: "c", text: "Đặt phòng" },
        { id: "d", text: "Hỏi đường" }
      ],
      correctOptionId: "a",
      explanationVi: "点菜 là gọi món; 我们要点菜 nghĩa là chúng tôi muốn gọi món.",
      relatedWordIds: ["word-diancai"],
      cueId: "cue-17-2"
    },
    {
      id: "q17-2", type: "multiple-choice", promptVi: "Từ nào chỉ thực đơn?",
      options: [
        { id: "a", text: "烤鸭" },
        { id: "b", text: "买单" },
        { id: "c", text: "菜单" },
        { id: "d", text: "服务员" }
      ],
      correctOptionId: "c",
      explanationVi: "菜单 nghĩa là thực đơn, dùng khi xin thực đơn tại nhà hàng.",
      relatedWordIds: ["word-caidan"],
      cueId: "cue-17-1"
    },
    {
      id: "q17-3", type: "fill-blank", promptVi: "Điền từ nghĩa là gọi món: 我们要____。",
      acceptedAnswers: ["点菜"],
      normalization: "trim-and-remove-final-punctuation",
      explanationVi: "我们要点菜 nghĩa là chúng tôi muốn gọi món.",
      relatedWordIds: ["word-diancai"],
      cueId: "cue-17-2"
    },
    {
      id: "q17-4", type: "multiple-choice", promptVi: "Câu nào dùng khi muốn thanh toán?",
      options: [
        { id: "a", text: "请给我菜单。" },
        { id: "b", text: "我们要买单。" },
        { id: "c", text: "这里的烤鸭怎么样？" },
        { id: "d", text: "下次再来。" }
      ],
      correctOptionId: "b",
      explanationVi: "买单 diễn đạt việc thanh toán; câu B nghĩa là chúng tôi muốn thanh toán.",
      relatedWordIds: ["word-maidan"],
      cueId: "cue-17-7"
    },
    {
      id: "q17-5", type: "multiple-choice", promptVi: "烤鸭 là món gì?",
      options: [
        { id: "a", text: "Mì" },
        { id: "b", text: "Cơm" },
        { id: "c", text: "Bánh bao" },
        { id: "d", text: "Vịt quay" }
      ],
      correctOptionId: "d",
      explanationVi: "烤鸭 là vịt quay.",
      relatedWordIds: ["word-kaoya"],
      cueId: "cue-17-3"
    }
  ]
};

// Recommendation Ranking Algorithm (Section 9.2 in Spec)
export function getRecommendedLessons(user: User, lessons: Lesson[], progressList: LessonProgress[]): Array<Lesson & { reason: string }> {
  const profile = user.learningProfile;
  if (!profile) return lessons.map(l => ({ ...l, reason: "✨ Bài học đề xuất" }));

  const published = lessons.filter(l => l.status === "published");

  const scored = published.map(lesson => {
    let score = 0;
    let primaryReason = "✨ Phù hợp trình độ của bạn";

    // Matching HSK level
    if (lesson.hsk === profile.hskLevel) {
      score += 4;
      primaryReason = `✨ Đúng trình độ HSK ${profile.hskLevel}`;
    }

    // Matching topics
    const matchingTopics = lesson.topics.filter(t => profile.topics.includes(t));
    if (matchingTopics.length > 0) {
      score += matchingTopics.length * 2;
      const topicLabel = TOPICS.find(t => t.id === matchingTopics[0])?.labelVi || matchingTopics[0];
      primaryReason = `✨ Bạn quan tâm chủ đề ${topicLabel}`;
    }

    // Matching goal
    if (lesson.goalTags.includes(profile.goal)) {
      score += 2;
      const goalLabelMap: Record<string, string> = {
        business: "Kinh doanh",
        travel: "Du lịch",
        daily: "Giao tiếp hằng ngày",
        hsk: "Luyện thi HSK"
      };
      primaryReason = `✨ Khớp mục tiêu ${goalLabelMap[profile.goal] || profile.goal}`;
    }

    // In-progress bonus
    const p = progressList.find(pr => pr.lessonId === lesson.id);
    if (p && !p.completed && p.lastPositionSeconds > 0) {
      score += 3;
      primaryReason = "✨ Bạn đang học dở, tiếp tục ngay";
    }

    return {
      ...lesson,
      score,
      reason: primaryReason
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Format Seconds to MM:SS
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Nhắc nhở chuỗi học 🔥', message: 'Bạn đã giữ streak 14 ngày! Hãy hoàn thành 1 bài hôm nay.', time: '10 phút trước', unread: true },
  { id: '2', title: 'Bài học AI mới ✨', message: 'HANFLIX vừa phát hành bài "Đàm phán giá hợp đồng" HSK 3.', time: '1 giờ trước', unread: true },
  { id: '3', title: 'Kết quả thi thử HSK 🎓', message: 'Bài làm phần Nghe HSK 3 đạt 88/100 điểm. Xem chi tiết!', time: 'Hôm qua', unread: false }
];
