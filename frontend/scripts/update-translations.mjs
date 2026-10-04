import fs from "node:fs"

const newMessages = {
  "Bứt phá tiếng Trung qua video & phim ảnh thực tế": [
    "Master Chinese through real-world videos & cinema",

    "通过影视与真实视频突破中文",
  ],

  "Khám phá phương pháp học ngôn ngữ tự nhiên và hiệu quả nhất. Không học vẹt, nhớ từ vựng sâu qua ngữ cảnh phim sinh động.":
    [
      "Discover the most natural and effective language learning method. No rote memorization, remember vocabulary deeply through vivid movie contexts.",

      "探索最自然有效的语言学习方法。拒绝死记硬背，在生动的影视语境中深度记忆词汇。",
    ],

  "Hệ thống ôn tập từ vựng SRS thông minh": [
    "Smart SRS vocabulary review system",

    "智能 SRS 词汇复习系统",
  ],

  "Kích hoạt ngay lập tức": [
    "Instant activation",

    "即刻开通",
  ],

  "Hủy bất cứ lúc nào": [
    "Cancel anytime",

    "随时取消",
  ],

  "Video học thử miễn phí": [
    "Free trial sample lessons",

    "免费试学视频",
  ],

  "Trải nghiệm phương pháp học qua video có phụ đề tương tác và tra từ trực tiếp.":
    [
      "Experience learning through videos with interactive subtitles and direct lookup.",

      "体验通过互动字幕与直接查词的视频学习方法。",
    ],

  "Xem tất cả": [
    "View all",

    "查看全部",
  ],

  "Danh sách video mẫu đang được cập nhật": [
    "Sample video list is being updated",

    "示范视频列表正在更新中",
  ],

  "Bạn có thể khám phá danh mục bài học đầy đủ của HanFlix ngay bây giờ.": [
    "You can explore HanFlix full lesson catalog right now.",

    "您可以立即浏览 HanFlix 的完整课程目录。",
  ],

  "Xem danh mục bài học": [
    "Explore lesson catalog",

    "浏览课程目录",
  ],

  "Vì sao nên học cùng HanFlix?": [
    "Why learn with HanFlix?",

    "为什么选择 HanFlix？",
  ],

  "Công nghệ học ngoại ngữ hiện đại được thiết kế riêng cho người Việt học tiếng Trung.":
    [
      "Modern language learning technology tailored for learning Chinese.",

      "专为学习中文打造的现代语言学习技术。",
    ],

  "Tương tác tức thì": [
    "Instant interaction",

    "即时互动",
  ],

  "Phụ đề 3 dòng thông minh": [
    "Smart 3-line subtitles",

    "智能三行字幕",
  ],

  "Chạm vào bất kỳ chữ Hán nào trong phim để tra pinyin, âm Hán Việt, giải nghĩa và ngữ pháp mà không làm gián đoạn trải nghiệm xem.":
    [
      "Tap any Chinese character in the video to view pinyin, Sino-Vietnamese reading, definition, and grammar without pausing your flow.",

      "点击影视中的任意汉字即可查看拼音、释义与语法，完全不打断观看体验。",
    ],

  "Gia sư ảo AI 24/7": [
    "24/7 Virtual AI Tutor",

    "24/7 虚拟 AI 导师",
  ],

  "Học 1-1 cùng AI Bảo Bảo": [
    "1-on-1 learning with AI Bao Bao",

    "与 AI 宝宝进行 1 对 1 学习",
  ],

  "Luyện nói và nhận phản hồi phát âm thanh điệu tức thì. Đặt câu hỏi thắc mắc về phân cảnh phim bất cứ lúc nào.":
    [
      "Practice speaking and get immediate feedback on tones. Ask questions about movie scenes at any time.",

      "练习口语并获取实时声调发音反馈。随时提问关于影视片段的疑问。",
    ],

  "Khoa học não bộ": [
    "Brain science",

    "脑科学记忆",
  ],

  "Ghi nhớ từ vựng vĩnh viễn": [
    "Remember vocabulary permanently",

    "永久记住词汇",
  ],

  "Hệ thống SRS tự động lên lịch nhắc bạn ôn tập những từ vựng đã lưu vào đúng thời điểm não bộ chuẩn bị quên.":
    [
      "The SRS system automatically schedules reminders to review saved vocabulary right before memory fades.",

      "SRS 间隔重复系统会在记忆即将遗忘的临界点自动提醒您复习已保存词汇。",
    ],

  "So sánh quyền lợi": [
    "Plan comparison",

    "权益对比",
  ],

  "Lựa chọn gói học phù hợp với mục tiêu của bạn": [
    "Choose the right plan for your learning goals",

    "选择适合您学习目标的套餐",
  ],

  "Xem chi tiết các gói": [
    "View all plans in detail",

    "查看套餐详情",
  ],

  "Tính năng": [
    "Feature",

    "功能特性",
  ],

  "Tài khoản Free": [
    "Free account",

    "免费账户",
  ],

  "Kho video bài học": [
    "Lesson video library",

    "课程视频库",
  ],

  "Không giới hạn": [
    "Unlimited",

    "无限畅学",
  ],

  "Phụ đề & Tra từ": [
    "Subtitles & Dictionary",

    "字幕与查词",
  ],

  "Tra từ cơ bản": [
    "Basic dictionary lookup",

    "基础查词",
  ],

  "3 dòng Pinyin, dịch nghĩa, lưu từ": [
    "3-line Pinyin, translations, word saving",

    "三行拼音、释义及生词保存",
  ],

  "AI Bảo Bảo sửa phát âm": [
    "AI Bao Bao pronunciation coach",

    "AI 宝宝发音纠正",
  ],

  "Hỗ trợ 24/7": [
    "24/7 Support",

    "24/7 全天候支持",
  ],

  "Ôn tập SRS thông minh": [
    "Smart SRS review",

    "智能 SRS 间隔复习",
  ],

  "Thuật toán ngắt quãng": [
    "Spaced repetition algorithm",

    "科学间隔重复算法",
  ],

  "Đề thi thử HSK": [
    "HSK mock exams",

    "HSK 模拟考题",
  ],

  "Đầy đủ đề & chấm điểm": [
    "Full tests & instant scoring",

    "完整试卷与即时评分",
  ],

  "Sẵn sàng bứt phá tiếng Trung của bạn?": [
    "Ready to master your Chinese?",

    "准备好突破您的中文水平了吗？",
  ],

  "Trải nghiệm 15 ngày dùng thử miễn phí, mở khóa toàn bộ bài học và tính năng AI ngay hôm nay.":
    [
      "Experience a 15-day free trial, unlocking all lessons and AI features today.",

      "立即开启 15 天免费试用，解锁全部课程与 AI 特权。",
    ],

  "Nâng cấp ngay để mở khóa toàn bộ kho bài học và trợ lý AI Bảo Bảo.": [
    "Upgrade now to unlock the complete video library and AI assistant.",

    "立即升级解锁全部课程库与 AI 助手。",
  ],

  "Hệ thống ghi nhớ từ vựng SRS thông minh": [
    "Intelligent SRS vocabulary retention system",

    "智能 SRS 词汇记忆系统",
  ],

  "Lưu từ trực tiếp từ video, tự động lên lịch nhắc ôn ngắt quãng và luyện flashcard phát âm chuẩn bản xứ.":
    [
      "Save words directly from videos, automatically schedule spaced reviews, and practice flashcards with native pronunciation.",

      "直接从视频中收藏生词，自动安排间隔复习，练习原汁原味的母语发音闪卡。",
    ],

  "Lưu từ vựng không giới hạn từ mọi video": [
    "Unlimited vocabulary saving from any video",

    "不限次数从所有视频中收藏生词",
  ],

  "Thuật toán ngắt quãng Spaced Repetition (SRS)": [
    "Spaced Repetition Algorithm (SRS)",

    "间隔重复记忆算法（SRS）",
  ],

  "Flashcard phát âm chuẩn & ví dụ song ngữ": [
    "Native pronunciation flashcards & bilingual examples",

    "标准母语发音闪卡与双语例句",
  ],

  "Kho ngữ pháp thực chiến qua phim": [
    "Practical grammar mastery through movies",

    "影视实战语法库",
  ],

  "Làm chủ toàn bộ ngữ pháp HSK qua các đoạn hội thoại thực tế trong phim ảnh, có phân tích ngữ cảnh và ví dụ sinh động.":
    [
      "Master all HSK grammar points through authentic dialogues in movies, featuring context analysis and vivid examples.",

      "通过电影中的真实对话掌握所有 HSK 语法，提供语境剖析与生动例句。",
    ],

  "Đầy đủ điểm ngữ pháp HSK 1 đến HSK 6": [
    "Comprehensive grammar points from HSK 1 to HSK 6",

    "涵盖 HSK 1 至 HSK 6 完整语法点",
  ],

  "Ví dụ trích đoạn trực tiếp từ phim ảnh": [
    "Examples excerpted directly from movies",

    "例句直接选自影视原片",
  ],

  "Bài tập phân tích cấu trúc câu tương tác": [
    "Interactive sentence structure analysis exercises",

    "互动式句子结构分析练习",
  ],

  "Lộ trình học tập cá nhân hóa": [
    "Personalized learning roadmap",

    "个性化学习路线图",
  ],

  "Định hướng mục tiêu theo trình độ, đề xuất bài học tối ưu theo sở thích và theo dõi sát sao tiến độ mỗi ngày.":
    [
      "Target goals aligned with your level, tailored lesson recommendations based on interests, and close daily progress tracking.",

      "根据水平明确目标，按兴趣推荐最优课程，每日紧密跟踪学习进度。",
    ],

  "Lộ trình thiết kế riêng theo cấp độ HSK": [
    "Custom roadmap designed for each HSK level",

    "专为各 HSK 级别量身定制的路线图",
  ],

  "Đề xuất bài học thông minh theo sở thích": [
    "Smart lesson recommendations based on interests",

    "基于兴趣的智能课程推荐",
  ],

  "Theo dõi trực quan tiến độ chinh phục mục tiêu": [
    "Visual tracking for target milestone completion",

    "直观跟踪目标达成进度",
  ],

  "Báo cáo & Thống kê học tập chi tiết": [
    "Detailed study reports & analytics",

    "详细学习报告与统计",
  ],

  "Ghi nhận từng phút xem phim, số từ vựng tích lũy và hiệu quả ghi nhớ để duy trì động lực học bền bỉ.":
    [
      "Track every minute watched, accumulated vocabulary, and memory retention to maintain strong study momentum.",

      "记录观看的每一分钟、积累的词汇量和记忆效果，保持持久的学习动力。",
    ],

  "Thống kê chi tiết giờ học & từ vựng tích lũy": [
    "Detailed study hours & accumulated vocabulary stats",

    "学习时长与积累词汇详细统计",
  ],

  "Biểu đồ chuỗi ngày học liên tục (Streak)": [
    "Daily study streak chart",

    "每日连续学习图表（Streak）",
  ],

  "Phân tích điểm mạnh và kỹ năng cần cải thiện": [
    "Analysis of strengths and areas for improvement",

    "强项分析与待提升技能",
  ],

  "Trọn bộ đề thi thử HSK có chấm điểm": [
    "Complete HSK mock exams with automated scoring",

    "含自动评分的全套 HSK 模拟试卷",
  ],

  "Luyện thi với ngân hàng đề thi chuẩn cấu trúc HSK mới nhất, có đồng hồ bấm giờ và giải thích đáp án chi tiết.":
    [
      "Practice with mock exams matching the latest HSK format, complete with timers and in-depth explanations.",

      "使用符合最新 HSK 结构的题库进行模考，配有计时器和详细答案解析。",
    ],

  "Đề thi thử chuẩn cấu trúc HSK mới nhất": [
    "Mock exams matching the latest HSK structure",

    "符合最新 HSK 结构的模拟试题",
  ],

  "Chấm điểm tự động và xếp loại ngay lập tức": [
    "Automated scoring and instant grade evaluation",

    "自动评分与即时等级判定",
  ],

  "Giải thích chi tiết từng câu hỏi & ngữ pháp": [
    "Detailed explanations for every question & grammar point",

    "每道试题与语法点的详细解析",
  ],

  "Cần nâng cấp tài khoản để sử dụng tính năng này": [
    "Please upgrade your account to use this feature",

    "请升级您的账户以使用此功能",
  ],

  "Nâng cấp HanFlix Premium để lưu từ vựng không giới hạn, kích hoạt thuật toán ôn tập SRS ngắt quãng và luyện flashcard phát âm chuẩn bản xứ.":
    [
      "Upgrade to HanFlix Premium to save unlimited vocabulary, activate spaced repetition (SRS), and practice flashcards with native pronunciation.",

      "升级 HanFlix Premium 以无限收藏生词，启用间隔重复记忆算法（SRS），并练习纯正母语发音闪卡。",
    ],

  "Nâng cấp HanFlix Premium để làm chủ toàn bộ ngữ pháp HSK qua các đoạn hội thoại thực tế trong phim ảnh có phân tích ngữ cảnh chi tiết.":
    [
      "Upgrade to HanFlix Premium to master all HSK grammar through authentic movie dialogues with detailed context analysis.",

      "升级 HanFlix Premium 以通过电影真实对话掌握全部 HSK 语法，配有详细语境剖析。",
    ],

  "Nâng cấp HanFlix Premium để định hướng lộ trình học tập cá nhân hóa theo cấp độ HSK và theo dõi sát sao tiến độ mỗi ngày.":
    [
      "Upgrade to HanFlix Premium to get a personalized learning roadmap for your HSK level and track daily progress closely.",

      "升级 HanFlix Premium 以获取专属于您 HSK 级别的个性化学习路线图，紧密跟踪每日进度。",
    ],

  "Nâng cấp HanFlix Premium để theo dõi chi tiết báo cáo giờ học, biểu đồ chuỗi streak và mức độ nắm vững từ vựng.":
    [
      "Upgrade to HanFlix Premium to track detailed study hours, streak charts, and vocabulary mastery levels.",

      "升级 HanFlix Premium 以查看详细学习时长报告、连续打卡图表与词汇掌握度。",
    ],

  "Nâng cấp HanFlix Premium để mở khóa trọn bộ ngân hàng đề thi thử HSK chuẩn cấu trúc mới, có bấm giờ và chấm điểm tự động.":
    [
      "Upgrade to HanFlix Premium to unlock full mock HSK exam bank with timers and automated grading.",

      "升级 HanFlix Premium 以解锁符合最新结构的完整 HSK 模考题库，配有计时器和自动评分。",
    ],

  "Nâng cấp HanFlix Premium để mở khóa nội dung này, học qua video không giới hạn và nhận trợ giúp từ AI Bảo Bảo.":
    [
      "Upgrade to HanFlix Premium to unlock this content, enjoy unlimited video learning, and get help from AI Bao Bao.",

      "升级 HanFlix Premium 以解锁此内容，畅享无限视频学习，并获得 AI 宝助手的指导。",
    ],

  "🎁 15 ngày Premium miễn phí cho lần đăng nhập đầu tiên": [
    "🎁 15 days of free Premium for your first login",

    "🎁 首次登录尊享 15 天免费 Premium",
  ],

  "Chọn bất kỳ gói Premium nào để bắt đầu trải nghiệm.": [
    "Choose any Premium plan to start experiencing.",

    "选择任意 Premium 套餐开启体验。",
  ],

  "Không tự động gia hạn.": [
    "No auto-renewal.",

    "不会自动续费。",
  ],

  "Trải nghiệm linh hoạt trọn vẹn": [
    "Complete and flexible experience",

    "灵活且完整的体验",
  ],
}

const filePath = "src/i18n/messages.json"

const data = JSON.parse(fs.readFileSync(filePath, "utf8"))

Object.assign(data, newMessages)

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8")

console.log(
  "Merged " +
    Object.keys(newMessages).length +
    " translation keys successfully.",
)
