import { Types } from 'mongoose';
import { LessonModel } from '../models/lesson.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { UserModel } from '../models/user.model.js';
import { SavedWordModel } from '../models/saved-word.model.js';

export interface ModuleTopic {
  id: string;
  nameVi: string;
  progress: number;
  status: 'completed' | 'in_progress' | 'not_started';
  totalLessons?: number;
  completedLessons?: number;
}

export interface RoadmapStage {
  id: string;
  level: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'locked';
  progress: number;
  wordCount: string;
  grammarCount: string;
  totalLessons: number;
  completedLessons: number;
  topics: ModuleTopic[];
}

export interface RoadmapResult {
  currentHsk: number;
  targetHsk: number;
  overallProgress: number;
  stages: RoadmapStage[];
}

const STAGE_CONFIGS: Record<number, {
  title: string;
  description: string;
  wordCount: string;
  grammarCount: string;
  defaultTopics: Array<{ id: string; nameVi: string }>;
}> = {
  1: {
    title: 'Nhập môn Giao tiếp & Pinyin',
    description: 'Làm quen bảng chữ cái Pinyin, phát âm chuẩn thanh điệu, chào hỏi và xưng hô thường nhật.',
    wordCount: '150 từ',
    grammarCount: '15 cấu trúc',
    defaultTopics: [
      { id: 't1-1', nameVi: 'Chào hỏi & Giới thiệu bản thân' },
      { id: 't1-2', nameVi: 'Con số, Mua sắm cơ bản & Hỏi giá' },
      { id: 't1-3', nameVi: 'Thời gian, Lịch hẹn & Thời tiết' },
    ],
  },
  2: {
    title: 'Sơ cấp Đời sống & Du lịch',
    description: 'Giao tiếp tình huống hàng ngày, đi lại phương tiện công cộng, gọi món và sở thích cá nhân.',
    wordCount: '300 từ',
    grammarCount: '28 cấu trúc',
    defaultTopics: [
      { id: 't2-1', nameVi: 'Giao thông, Đi tàu cao tốc & Sân bay' },
      { id: 't2-2', nameVi: 'Thói quen sinh hoạt & Hoạt động cuối tuần' },
      { id: 't2-3', nameVi: 'Ăn uống, Gọi món tại quán ăn bình dân' },
    ],
  },
  3: {
    title: 'Trung cấp Thương mại & Du lịch',
    description: 'Nắm vững đàm phán nhẹ, xử lý đặt phòng khách sạn, giao tiếp công sở và phỏng vấn xin việc.',
    wordCount: '600 từ',
    grammarCount: '45 cấu trúc',
    defaultTopics: [
      { id: 't3-1', nameVi: 'Gọi món nhà hàng đặc sản & Phong vị vùng miền' },
      { id: 't3-2', nameVi: 'Đặt phòng, Check-in & Yêu cầu dịch vụ khách sạn' },
      { id: 't3-3', nameVi: 'Phỏng vấn xin việc & Viết email công việc' },
      { id: 't3-4', nameVi: 'Thương lượng giá cả & Hợp đồng cơ bản' },
    ],
  },
  4: {
    title: 'Cao cấp Công việc & Doanh nghiệp',
    description: 'Tranh luận chủ đề phức tạp, thuyết trình báo cáo kinh doanh, trao đổi chuyên sâu với đối tác.',
    wordCount: '1.200 từ',
    grammarCount: '65 cấu trúc',
    defaultTopics: [
      { id: 't4-1', nameVi: 'Thuyết trình kế hoạch kinh doanh' },
      { id: 't4-2', nameVi: 'Đàm phán điều khoản hợp đồng thương mại' },
      { id: 't4-3', nameVi: 'Xử lý tình huống phát sinh & Khủng hoảng' },
    ],
  },
  5: {
    title: 'Chuyên sâu Văn hóa & Báo chí',
    description: 'Đọc hiểu báo chí Trung văn, xem phim truyền hình không cần phụ đề, viết luận văn chuyên ngành.',
    wordCount: '2.500 từ',
    grammarCount: '80 cấu trúc',
    defaultTopics: [
      { id: 't5-1', nameVi: 'Đọc hiểu phóng sự & Tin tức thời sự' },
      { id: 't5-2', nameVi: 'Tác phẩm văn học & Thành ngữ điển cố' },
      { id: 't5-3', nameVi: 'Thảo luận kinh tế xã hội đương đại' },
    ],
  },
  6: {
    title: 'Thành thạo Tự nhiên & Bản ngữ',
    description: 'Sử dụng tiếng Trung linh hoạt như người bản xứ, thấu hiểu ngữ cảnh tinh tế và phong cách văn học.',
    wordCount: '5.000+ từ',
    grammarCount: '100+ cấu trúc',
    defaultTopics: [
      { id: 't6-1', nameVi: 'Hùng biện, Phản biện học thuật & Đàm phán cấp cao' },
      { id: 't6-2', nameVi: 'Ngôn ngữ cổ văn & Thơ ca kinh điển' },
      { id: 't6-3', nameVi: 'Giao tiếp bản ngữ tự nhiên và tiếng lóng hiện đại' },
    ],
  },
};

export class RoadmapService {
  /**
   * Generates the personalized roadmap stages for the given user.
   */
  static async getRoadmap(userId: string): Promise<RoadmapResult> {
    const user = await UserModel.findById(userId).select('learningProfile').lean();
    const currentHsk = user?.learningProfile?.currentHsk || 1;
    const targetHsk = user?.learningProfile?.targetHsk || 6;

    // 1. Fetch all published lessons
    const publishedLessons = await LessonModel.find({ status: 'published' })
      .select('_id hsk titleVi topicIds')
      .lean();

    // 2. Fetch user completed lessons
    const userProgressList = await ProgressModel.find({
      userId: new Types.ObjectId(userId),
      completed: true,
    }).select('lessonId').lean();

    const completedLessonIdSet = new Set(userProgressList.map((p) => p.lessonId.toString()));

    // 3. Group published lessons by HSK
    const lessonsByHsk: Record<number, Array<{ _id: string; titleVi: string; topicIds: string[] }>> = {};
    for (let lvl = 1; lvl <= 6; lvl++) {
      lessonsByHsk[lvl] = [];
    }
    for (const lesson of publishedLessons) {
      const lvl = lesson.hsk;
      if (lvl >= 1 && lvl <= 6) {
        lessonsByHsk[lvl]?.push({
          _id: lesson._id.toString(),
          titleVi: lesson.titleVi,
          topicIds: lesson.topicIds || [],
        });
      }
    }

    // 4. Construct the 6 stages
    const stages: RoadmapStage[] = [];
    let totalCompletedAll = 0;
    let totalLessonsAll = 0;

    for (let level = 1; level <= 6; level++) {
      const cfg = STAGE_CONFIGS[level]!;
      const lessons = lessonsByHsk[level] || [];
      const totalLessons = lessons.length;
      const completedLessons = lessons.filter((l) => completedLessonIdSet.has(l._id)).length;

      totalCompletedAll += completedLessons;
      totalLessonsAll += totalLessons;

      let progress = 0;
      let status: 'completed' | 'in_progress' | 'locked' = 'locked';

      if (totalLessons > 0) {
        progress = Math.round((completedLessons / totalLessons) * 100);
        if (progress >= 100) {
          status = 'completed';
        } else if (level <= currentHsk) {
          status = 'in_progress';
        } else {
          status = 'locked';
        }
      } else {
        // When there are no uploaded lessons yet for higher HSK levels
        if (level < currentHsk) {
          progress = 100;
          status = 'completed';
        } else if (level === currentHsk) {
          progress = 40;
          status = 'in_progress';
        } else {
          progress = 0;
          status = 'locked';
        }
      }

      // Build module topics
      const topics: ModuleTopic[] = cfg.defaultTopics.map((dt, idx) => {
        let topicProgress = 0;
        let topicStatus: 'completed' | 'in_progress' | 'not_started' = 'not_started';

        if (status === 'completed') {
          topicProgress = 100;
          topicStatus = 'completed';
        } else if (status === 'in_progress') {
          if (idx === 0) {
            topicProgress = Math.max(progress, 50);
            topicStatus = topicProgress >= 100 ? 'completed' : 'in_progress';
          } else if (idx === 1) {
            topicProgress = Math.min(progress, 30);
            topicStatus = topicProgress > 0 ? 'in_progress' : 'not_started';
          } else {
            topicProgress = 0;
            topicStatus = 'not_started';
          }
        }

        return {
          id: dt.id,
          nameVi: dt.nameVi,
          progress: topicProgress,
          status: topicStatus,
        };
      });

      stages.push({
        id: `hsk${level}`,
        level: `HSK ${level}`,
        title: cfg.title,
        description: cfg.description,
        status,
        progress,
        wordCount: cfg.wordCount,
        grammarCount: cfg.grammarCount,
        totalLessons,
        completedLessons,
        topics,
      });
    }

    const overallProgress = totalLessonsAll > 0
      ? Math.round((totalCompletedAll / totalLessonsAll) * 100)
      : Math.round(((currentHsk - 1) / 6) * 100);

    return {
      currentHsk,
      targetHsk,
      overallProgress,
      stages,
    };
  }
}
