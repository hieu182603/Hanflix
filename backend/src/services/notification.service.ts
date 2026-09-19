import { Types } from 'mongoose';
import { NotificationModel, type NotificationDoc } from '../models/notification.model.js';
import { UserModel } from '../models/user.model.js';

export interface LocalizedContent {
  vi: string;
  en?: string;
  zh?: string;
}

export interface CreateNotificationInput {
  userId: Types.ObjectId | string;
  type: 'streak' | 'lesson' | 'quiz' | 'vocab' | 'video_pipeline' | 'system';
  category?: 'study' | 'system';
  title: LocalizedContent;
  message: LocalizedContent;
  actionUrl?: string;
  actionText?: LocalizedContent;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * Tạo 1 thông báo mới cho người dùng
   */
  static async createNotification(input: CreateNotificationInput) {
    const category = input.category || (input.type === 'video_pipeline' || input.type === 'system' ? 'system' : 'study');
    return NotificationModel.create({
      userId: new Types.ObjectId(input.userId.toString()),
      type: input.type,
      category,
      title: {
        vi: input.title.vi,
        en: input.title.en || input.title.vi,
        zh: input.title.zh || input.title.vi,
      },
      message: {
        vi: input.message.vi,
        en: input.message.en || input.message.vi,
        zh: input.message.zh || input.message.vi,
      },
      isRead: false,
      actionUrl: input.actionUrl,
      actionText: input.actionText ? {
        vi: input.actionText.vi,
        en: input.actionText.en || input.actionText.vi,
        zh: input.actionText.zh || input.actionText.vi,
      } : undefined,
      metadata: input.metadata,
    });
  }

  /**
   * Phát thông báo tới toàn bộ tài khoản Quản trị viên (Admin)
   *
   * Dùng batched insertMany theo từng chunk 500 docs để tránh vượt giới
   * hạn 16MB BSON document của MongoDB khi broadcast tới hàng chục nghìn
   * admin. Hàm này KHÔNG thật sự cần transaction vì insertMany là atomic
   * per-batch; nếu batch cuối fail, các batch trước vẫn thành công (đó là
   * mong muốn — admin thấy "sent count" chính xác với DB).
   */
  static async notifyAdmins(input: Omit<CreateNotificationInput, 'userId'>) {
    const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('_id').lean();
    if (!admins.length) return [];

    const batchSize = 500;
    const docs = admins.map(admin => ({
      userId: admin._id,
      type: input.type,
      category: input.category || 'system',
      title: {
        vi: input.title.vi,
        en: input.title.en || input.title.vi,
        zh: input.title.zh || input.title.vi,
      },
      message: {
        vi: input.message.vi,
        en: input.message.en || input.message.vi,
        zh: input.message.zh || input.message.vi,
      },
      isRead: false,
      actionUrl: input.actionUrl,
      actionText: input.actionText ? {
        vi: input.actionText.vi,
        en: input.actionText.en || input.actionText.vi,
        zh: input.actionText.zh || input.actionText.vi,
      } : undefined,
      metadata: input.metadata,
    }));

    return this.batchedInsert(docs, batchSize);
  }

  /**
   * Phát thông báo tới các học viên phù hợp cấp độ HSK
   *
   * Hỗ trợ >100 learners: dùng cursor streaming để tránh OOM khi user
   * base lớn, và batch insert theo chunk để tránh 16MB BSON limit.
   * Atomicity: insertMany per-batch. Nếu một batch fail, các batch trước
   * vẫn giữ (partial success là behavior mong muốn cho broadcast).
   */
  static async notifyLearnersByHsk(hskLevel: number, input: Omit<CreateNotificationInput, 'userId'>) {
    const query: Record<string, unknown> = { role: 'user', status: 'active' };
    if (hskLevel > 0) {
      query.$or = [
        { 'learningProfile.currentHsk': hskLevel },
        { 'learningProfile.targetHsk': hskLevel },
      ];
    }

    const batchSize = 500;
    const cursor = UserModel.find(query).select('_id').lean().cursor({ batchSize });
    const inserted: Types.ObjectId[] = [];
    let buffer: Array<Record<string, unknown>> = [];

    const flush = async () => {
      if (buffer.length === 0) return;
      const docs = await NotificationModel.insertMany(buffer, { ordered: false });
      inserted.push(...docs.map(d => d._id));
      buffer = [];
    };

    for await (const learner of cursor) {
      buffer.push({
        userId: learner._id,
        type: input.type,
        category: input.category || 'study',
        title: {
          vi: input.title.vi,
          en: input.title.en || input.title.vi,
          zh: input.title.zh || input.title.vi,
        },
        message: {
          vi: input.message.vi,
          en: input.message.en || input.message.vi,
          zh: input.message.zh || input.message.vi,
        },
        isRead: false,
        actionUrl: input.actionUrl,
        actionText: input.actionText ? {
          vi: input.actionText.vi,
          en: input.actionText.en || input.actionText.vi,
          zh: input.actionText.zh || input.actionText.vi,
        } : undefined,
        metadata: input.metadata,
      });
      if (buffer.length >= batchSize) await flush();
    }
    await flush();

    return inserted;
  }

  /**
   * Batch insert helper: chia `docs` thành các chunk `batchSize` và gọi
   * `insertMany` cho mỗi chunk. Dùng `{ ordered: false }` để một document
   * lỗi (vd. duplicate key) không chặn các document khác.
   */
  private static async batchedInsert<T extends Record<string, unknown>>(
    docs: T[],
    batchSize: number,
  ): Promise<Array<Record<string, unknown>>> {
    const allInserted: Array<Record<string, unknown>> = [];
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const inserted = await NotificationModel.insertMany(chunk, { ordered: false });
      allInserted.push(...(inserted as unknown as Array<Record<string, unknown>>));
    }
    return allInserted;
  }

  /**
   * Lấy danh sách thông báo của người dùng kèm phân trang và bộ lọc
   */
  static async getUserNotifications(
    userId: Types.ObjectId | string,
    filter: 'all' | 'unread' | 'study' | 'system' = 'all',
    page = 1,
    limit = 20,
  ) {
    const targetUserId = new Types.ObjectId(userId.toString());

    // Khởi tạo thông báo chào mừng nếu user chưa có notification nào.
    // Đọc currentHsk từ learningProfile của user thay vì hard-code = 3.
    const profile = await UserModel.findById(targetUserId)
      .select('learningProfile.currentHsk')
      .lean();
    const rawHsk = profile?.learningProfile?.currentHsk;
    const hskLevel = typeof rawHsk === 'number' ? rawHsk : undefined;
    await this.ensureWelcomeNotifications(targetUserId, hskLevel);

    const query: Record<string, unknown> = { userId: targetUserId };
    if (filter === 'unread') query.isRead = false;
    else if (filter === 'study') query.category = 'study';
    else if (filter === 'system') query.category = 'system';

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total, unreadCount] = await Promise.all([
      NotificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      NotificationModel.countDocuments(query),
      NotificationModel.countDocuments({ userId: targetUserId, isRead: false }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Lấy số lượng thông báo chưa đọc nhanh
   */
  static async getUnreadCount(userId: Types.ObjectId | string): Promise<number> {
    const targetUserId = new Types.ObjectId(userId.toString());
    return NotificationModel.countDocuments({ userId: targetUserId, isRead: false });
  }

  /**
   * Cập nhật trạng thái đã đọc của 1 thông báo
   */
  static async markAsRead(userId: Types.ObjectId | string, notificationId: string, isRead = true) {
    if (!Types.ObjectId.isValid(notificationId)) return null;
    return NotificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId.toString()) },
      { $set: { isRead } },
      { new: true },
    ).lean();
  }

  /**
   * Đánh dấu toàn bộ thông báo của người dùng là đã đọc
   */
  static async markAllAsRead(userId: Types.ObjectId | string) {
    const targetUserId = new Types.ObjectId(userId.toString());
    const result = await NotificationModel.updateMany(
      { userId: targetUserId, isRead: false },
      { $set: { isRead: true } },
    );
    return { updatedCount: result.modifiedCount };
  }

  /**
   * Xóa 1 thông báo khỏi danh sách
   */
  static async deleteNotification(userId: Types.ObjectId | string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) return false;
    const result = await NotificationModel.deleteOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId.toString()),
    });
    return result.deletedCount > 0;
  }

  /**
   * Khởi tạo thông báo ban đầu thân thiện nếu người dùng chưa có thông báo nào
   *
   * Welcome notifications auto-expire sau 30 ngày (TTL index). Đây là
   * "intro" content — sau khi user đã quen với app, các notification này
   * không còn giá trị và chỉ chiếm storage.
   */
  static async ensureWelcomeNotifications(userId: Types.ObjectId, currentHsk?: number) {
    const hskLevel = currentHsk ?? 3;
    const count = await NotificationModel.countDocuments({ userId });
    if (count > 0) return;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const initialDocs = [
      {
        userId,
        type: 'streak',
        category: 'study',
        title: {
          vi: 'Bắt đầu chuỗi học tập HanFlix!',
          en: 'Start your HanFlix study streak!',
          zh: '开启您的 HanFlix 连续学习之旅！',
        },
        message: {
          vi: 'Hoàn thành 1 bài học ngắn hôm nay để kích hoạt chuỗi học tập ngọn lửa đầu tiên.',
          en: 'Complete 1 short video lesson today to ignite your first study streak.',
          zh: '今天完成1个简短视频课程即可点亮您的首个连续打卡纪录。',
        },
        isRead: false,
        actionUrl: '/lessons',
        actionText: {
          vi: 'Khám phá ngay',
          en: 'Explore Lessons',
          zh: '立即探索',
        },
        expiresAt,
      },
      {
        userId,
        type: 'lesson',
        category: 'study',
        title: {
          vi: `Lộ trình học tiếng Trung HSK ${hskLevel} đã sẵn sàng`,
          en: `HSK ${hskLevel} learning pathway is ready`,
          zh: `HSK ${hskLevel} 级进阶路径已就绪`,
        },
        message: {
          vi: 'Trải nghiệm phương pháp học phản xạ qua phim với phụ đề song ngữ và tra từ vựng tức thì.',
          en: 'Experience video immersion with interactive dual subtitles and instant vocabulary lookup.',
          zh: '体验影视沉浸式对白互动与一键生词即时查阅功能。',
        },
        isRead: false,
        actionUrl: '/lessons',
        actionText: {
          vi: 'Vào học bài',
          en: 'Start Learning',
          zh: '开始学习',
        },
        expiresAt,
      },
      {
        userId,
        type: 'system',
        category: 'system',
        title: {
          vi: 'Chào mừng bạn đến với HanFlix!',
          en: 'Welcome to HanFlix!',
          zh: '欢迎来到 HanFlix！',
        },
        message: {
          vi: 'Trung tâm thông báo sẽ cập nhật tiến độ học, từ vựng cần ôn tập và bài học mới nhất của bạn tại đây.',
          en: 'Your notification center will keep you updated on progress, vocabulary reviews, and new lessons.',
          zh: '通知中心将在此为您实时更新学习进度、复习提醒及最新课程动态。',
        },
        isRead: true,
        expiresAt,
      },
    ];

    await NotificationModel.insertMany(initialDocs);
  }
}
