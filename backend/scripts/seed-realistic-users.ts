/**
 * seed-realistic-users.ts
 * ======================
 * Reset & re-seed user-related data with 20 realistic learners + 2 admins.
 *
 * PRESERVES: Vocabulary (12,368), Grammar (573), Lessons, SubtitleTracks, Words, Quizzes.
 * RESETS:    Users, Progress, SavedWords, StudyActivity, QuizAttempts, RefreshSessions, AccountTokens.
 *
 * Usage:  npx tsx scripts/seed-realistic-users.ts
 */

import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { UserModel } from '../src/models/user.model.js';
import { ProgressModel } from '../src/models/progress.model.js';
import { SavedWordModel } from '../src/models/saved-word.model.js';
import { StudyActivityModel } from '../src/models/study-activity.model.js';
import { QuizAttemptModel } from '../src/models/quiz-attempt.model.js';
import { RefreshSessionModel } from '../src/models/refresh-session.model.js';
import { AccountTokenModel } from '../src/models/account-token.model.js';
import { LessonModel } from '../src/models/lesson.model.js';
import { WordModel } from '../src/models/word.model.js';
import { QuizModel } from '../src/models/quiz.model.js';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DEFAULT_PASSWORD = 'HanFlix2024!';  // Shared password for all seeded users
const BCRYPT_ROUNDS = 10;

// ─── ADMIN DATA ───────────────────────────────────────────────────────────────
const ADMINS = [
  {
    name: 'Nguyễn Quản Trị',
    email: 'admin@hanflix.local',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=admin1&backgroundColor=b6e3f4',
  },
  {
    name: 'Trần Minh Quản',
    email: 'quanly@hanflix.local',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=admin2&backgroundColor=ffd5dc',
  },
];

// ─── LEARNER DATA (20 Users) ──────────────────────────────────────────────────
// Mix of Vietnamese names, realistic learning profiles, various HSK levels
const LEARNERS = [
  {
    name: 'Lê Thanh Hằng',
    email: 'hang.le@gmail.com',
    avatarSeed: 'hang',
    currentHsk: 3, targetHsk: 5, goal: 'work' as const,
    focusSkills: ['listening', 'vocabulary'] as const[],
    dailyMinutes: 30, studyDaysPerWeek: 5,
    subtitlePreference: 'zh_pinyin' as const,
    activityLevel: 'high',     // many study days, high progress
  },
  {
    name: 'Phạm Đức Minh',
    email: 'minh.pham.dev@gmail.com',
    avatarSeed: 'minh',
    currentHsk: 2, targetHsk: 4, goal: 'hsk' as const,
    focusSkills: ['reading', 'vocabulary'] as const[],
    dailyMinutes: 20, studyDaysPerWeek: 4,
    subtitlePreference: 'all' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Nguyễn Thị Lan Anh',
    email: 'lananh.nguyen@outlook.com',
    avatarSeed: 'lananh',
    currentHsk: 1, targetHsk: 3, goal: 'travel' as const,
    focusSkills: ['listening', 'sentence_usage'] as const[],
    dailyMinutes: 15, studyDaysPerWeek: 3,
    subtitlePreference: 'all' as const,
    activityLevel: 'low',
  },
  {
    name: 'Trần Quốc Bảo',
    email: 'bao.tran@yahoo.com',
    avatarSeed: 'bao',
    currentHsk: 4, targetHsk: 6, goal: 'work' as const,
    focusSkills: ['reading', 'listening'] as const[],
    dailyMinutes: 45, studyDaysPerWeek: 6,
    subtitlePreference: 'zh_vi' as const,
    activityLevel: 'high',
  },
  {
    name: 'Võ Hoàng Yến',
    email: 'yen.vo@protonmail.com',
    avatarSeed: 'yen',
    currentHsk: 2, targetHsk: 4, goal: 'culture' as const,
    focusSkills: ['vocabulary', 'listening'] as const[],
    dailyMinutes: 25, studyDaysPerWeek: 4,
    subtitlePreference: 'zh_pinyin' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Hoàng Văn Tùng',
    email: 'tung.hoang@gmail.com',
    avatarSeed: 'tung',
    currentHsk: 1, targetHsk: 2, goal: 'daily' as const,
    focusSkills: ['listening'] as const[],
    dailyMinutes: 10, studyDaysPerWeek: 2,
    subtitlePreference: 'all' as const,
    activityLevel: 'low',
  },
  {
    name: 'Đặng Thị Mai',
    email: 'mai.dang@hotmail.com',
    avatarSeed: 'mai',
    currentHsk: 3, targetHsk: 5, goal: 'hsk' as const,
    focusSkills: ['reading', 'vocabulary', 'sentence_usage'] as const[],
    dailyMinutes: 40, studyDaysPerWeek: 5,
    subtitlePreference: 'zh_only' as const,
    activityLevel: 'high',
  },
  {
    name: 'Bùi Xuân Phong',
    email: 'phong.bui@gmail.com',
    avatarSeed: 'phong',
    currentHsk: 2, targetHsk: 3, goal: 'travel' as const,
    focusSkills: ['listening', 'vocabulary'] as const[],
    dailyMinutes: 20, studyDaysPerWeek: 3,
    subtitlePreference: 'zh_pinyin' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Lý Gia Hân',
    email: 'han.ly@gmail.com',
    avatarSeed: 'han',
    currentHsk: 5, targetHsk: 6, goal: 'work' as const,
    focusSkills: ['reading', 'sentence_usage'] as const[],
    dailyMinutes: 60, studyDaysPerWeek: 6,
    subtitlePreference: 'zh_only' as const,
    activityLevel: 'high',
  },
  {
    name: 'Ngô Kiều Trang',
    email: 'trang.ngo@outlook.com',
    avatarSeed: 'trang',
    currentHsk: 1, targetHsk: 3, goal: 'culture' as const,
    focusSkills: ['listening', 'reading'] as const[],
    dailyMinutes: 15, studyDaysPerWeek: 3,
    subtitlePreference: 'all' as const,
    activityLevel: 'low',
  },
  {
    name: 'Phan Anh Tuấn',
    email: 'tuan.phan@gmail.com',
    avatarSeed: 'tuan',
    currentHsk: 3, targetHsk: 5, goal: 'hsk' as const,
    focusSkills: ['vocabulary', 'listening', 'reading'] as const[],
    dailyMinutes: 35, studyDaysPerWeek: 5,
    subtitlePreference: 'zh_vi' as const,
    activityLevel: 'high',
  },
  {
    name: 'Huỳnh Ngọc Diễm',
    email: 'diem.huynh@yahoo.com',
    avatarSeed: 'diem',
    currentHsk: 2, targetHsk: 4, goal: 'daily' as const,
    focusSkills: ['listening', 'sentence_usage'] as const[],
    dailyMinutes: 20, studyDaysPerWeek: 4,
    subtitlePreference: 'all' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Trịnh Hữu Lộc',
    email: 'loc.trinh@protonmail.com',
    avatarSeed: 'loc',
    currentHsk: 4, targetHsk: 6, goal: 'work' as const,
    focusSkills: ['reading', 'vocabulary'] as const[],
    dailyMinutes: 50, studyDaysPerWeek: 6,
    subtitlePreference: 'zh_vi' as const,
    activityLevel: 'high',
  },
  {
    name: 'Vũ Thị Hạnh',
    email: 'hanh.vu@gmail.com',
    avatarSeed: 'hanh',
    currentHsk: 1, targetHsk: 2, goal: 'travel' as const,
    focusSkills: ['listening'] as const[],
    dailyMinutes: 10, studyDaysPerWeek: 2,
    subtitlePreference: 'all' as const,
    activityLevel: 'low',
  },
  {
    name: 'Đinh Quang Huy',
    email: 'huy.dinh@outlook.com',
    avatarSeed: 'huy',
    currentHsk: 3, targetHsk: 5, goal: 'hsk' as const,
    focusSkills: ['reading', 'vocabulary', 'listening'] as const[],
    dailyMinutes: 30, studyDaysPerWeek: 5,
    subtitlePreference: 'zh_pinyin' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Lương Mỹ Duyên',
    email: 'duyen.luong@gmail.com',
    avatarSeed: 'duyen',
    currentHsk: 2, targetHsk: 4, goal: 'culture' as const,
    focusSkills: ['vocabulary', 'sentence_usage'] as const[],
    dailyMinutes: 25, studyDaysPerWeek: 4,
    subtitlePreference: 'zh_pinyin' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Cao Minh Đức',
    email: 'duc.cao@hotmail.com',
    avatarSeed: 'duc',
    currentHsk: 5, targetHsk: 6, goal: 'work' as const,
    focusSkills: ['reading', 'listening', 'sentence_usage'] as const[],
    dailyMinutes: 60, studyDaysPerWeek: 7,
    subtitlePreference: 'zh_only' as const,
    activityLevel: 'high',
  },
  {
    name: 'Đỗ Thị Kiều Oanh',
    email: 'oanh.do@gmail.com',
    avatarSeed: 'oanh',
    currentHsk: 1, targetHsk: 3, goal: 'daily' as const,
    focusSkills: ['listening', 'vocabulary'] as const[],
    dailyMinutes: 15, studyDaysPerWeek: 3,
    subtitlePreference: 'all' as const,
    activityLevel: 'low',
  },
  {
    name: 'Tạ Văn Long',
    email: 'long.ta@yahoo.com',
    avatarSeed: 'long',
    currentHsk: 3, targetHsk: 5, goal: 'hsk' as const,
    focusSkills: ['vocabulary', 'reading'] as const[],
    dailyMinutes: 35, studyDaysPerWeek: 5,
    subtitlePreference: 'zh_vi' as const,
    activityLevel: 'medium',
  },
  {
    name: 'Mai Phương Thảo',
    email: 'thao.mai@gmail.com',
    avatarSeed: 'thao',
    currentHsk: 4, targetHsk: 6, goal: 'work' as const,
    focusSkills: ['reading', 'listening', 'vocabulary'] as const[],
    dailyMinutes: 45, studyDaysPerWeek: 6,
    subtitlePreference: 'zh_vi' as const,
    activityLevel: 'high',
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(7, 22), randomInt(0, 59), randomInt(0, 59), 0);
  return d;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🔌 Connecting to MongoDB Atlas...');
  await connectDatabase({ strictServerApi: false });
  console.log('✅ Connected.');

  // ─── Step 1: Drop user-related collections ────────────────────────────────
  console.log('\n🗑️  Resetting user-related data (preserving Vocabulary, Grammar, Lessons, Words, Subtitles, Quizzes)...');

  const resetResults = await Promise.all([
    UserModel.deleteMany({}),
    ProgressModel.deleteMany({}),
    SavedWordModel.deleteMany({}),
    StudyActivityModel.deleteMany({}),
    QuizAttemptModel.deleteMany({}),
    RefreshSessionModel.deleteMany({}),
    AccountTokenModel.deleteMany({}),
  ]);

  const labels = ['Users', 'Progress', 'SavedWords', 'StudyActivity', 'QuizAttempts', 'RefreshSessions', 'AccountTokens'];
  resetResults.forEach((r, i) => console.log(`   ❌ Deleted ${r.deletedCount} ${labels[i]}`));

  // ─── Step 2: Hash password once ───────────────────────────────────────────
  console.log('\n🔐 Hashing shared password...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // ─── Step 3: Create Admins ────────────────────────────────────────────────
  console.log('\n👑 Creating 2 Admin accounts...');
  const adminDocs = [];
  for (const admin of ADMINS) {
    const doc = await UserModel.create({
      name: admin.name,
      email: admin.email,
      passwordHash,
      role: 'admin',
      status: 'active',
      avatarUrl: admin.avatarUrl,
      emailVerifiedAt: daysAgo(randomInt(60, 120)),
      emailVerificationRequired: false,
      learningProfile: {
        currentHsk: 6,
        currentHskSource: 'assessed',
        targetHsk: 6,
        goal: 'work',
        focusSkills: ['reading', 'listening', 'vocabulary', 'sentence_usage'],
        dailyMinutes: 60,
        studyDaysPerWeek: 7,
        subtitlePreference: 'zh_only',
        surveyVersion: 1,
      },
    });
    adminDocs.push(doc);
    console.log(`   ✅ Admin: ${doc.email} (${doc._id})`);
  }

  // ─── Step 4: Create Learners ──────────────────────────────────────────────
  console.log('\n🎓 Creating 20 Learner accounts...');
  const learnerDocs = [];
  for (let i = 0; i < LEARNERS.length; i++) {
    const learner = LEARNERS[i];
    const createdDaysAgo = randomInt(7, 90);
    const doc = await UserModel.create({
      name: learner.name,
      email: learner.email,
      passwordHash,
      role: 'user',
      status: 'active',
      avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${learner.avatarSeed}&backgroundColor=${['b6e3f4', 'c0aede', 'ffd5dc', 'd1d4f9', 'ffdfbf'][i % 5]}`,
      emailVerifiedAt: daysAgo(createdDaysAgo),
      emailVerificationRequired: false,
      createdAt: daysAgo(createdDaysAgo),
      learningProfile: {
        currentHsk: learner.currentHsk,
        currentHskSource: learner.currentHsk >= 3 ? 'assessed' : 'self_reported',
        targetHsk: learner.targetHsk,
        goal: learner.goal,
        focusSkills: learner.focusSkills,
        topicIds: randomPick(['food', 'travel', 'daily', 'shopping', 'business', 'entertainment'], randomInt(2, 4)),
        dailyMinutes: learner.dailyMinutes,
        studyDaysPerWeek: learner.studyDaysPerWeek,
        subtitlePreference: learner.subtitlePreference,
        surveyVersion: 1,
      },
    });
    learnerDocs.push(doc);
    console.log(`   ✅ Learner ${(i + 1).toString().padStart(2, '0')}: ${doc.name.padEnd(22)} | ${doc.email.padEnd(32)} | HSK ${learner.currentHsk}→${learner.targetHsk} | ${learner.activityLevel}`);
  }

  // ─── Step 5: Load existing lessons & words for progress/activity generation ─
  console.log('\n📚 Loading existing Lessons & Words for activity generation...');
  const allLessons = await LessonModel.find({ status: 'published' }).lean();
  const allWords = await WordModel.find({}).limit(500).lean();
  const allQuizzes = await QuizModel.find({ status: 'published' }).lean();

  console.log(`   Found ${allLessons.length} published lessons, ${allWords.length} words (sample), ${allQuizzes.length} published quizzes`);

  if (allLessons.length === 0) {
    console.log('   ⚠️  No published lessons found. Skipping Progress, SavedWords, QuizAttempts generation.');
  }

  // ─── Step 6: Generate Progress, SavedWords, StudyActivity, QuizAttempts ───
  console.log('\n📊 Generating realistic learning activity...');

  let totalProgress = 0;
  let totalSavedWords = 0;
  let totalStudyDays = 0;
  let totalQuizAttempts = 0;

  for (const learner of learnerDocs) {
    const learnerData = LEARNERS[learnerDocs.indexOf(learner)];
    const activityLevel = learnerData.activityLevel;

    // How many lessons this user has interacted with
    const lessonCount = allLessons.length > 0
      ? activityLevel === 'high' ? Math.min(allLessons.length, randomInt(5, allLessons.length))
      : activityLevel === 'medium' ? Math.min(allLessons.length, randomInt(3, Math.ceil(allLessons.length * 0.7)))
      : Math.min(allLessons.length, randomInt(1, Math.ceil(allLessons.length * 0.4)))
      : 0;

    const selectedLessons = randomPick(allLessons, lessonCount);

    // ── Progress records ──
    for (let li = 0; li < selectedLessons.length; li++) {
      const lesson = selectedLessons[li];
      const isCompleted = activityLevel === 'high'
        ? li < selectedLessons.length * 0.7
        : activityLevel === 'medium'
          ? li < selectedLessons.length * 0.5
          : li < selectedLessons.length * 0.3;

      const watchedPercent = isCompleted ? 1.0 : Math.random() * 0.8 + 0.1;
      const lastPos = Math.round(lesson.durationSeconds * watchedPercent);
      const studySeconds = Math.round(lastPos * (1.2 + Math.random() * 0.5)); // watched + pauses

      await ProgressModel.create({
        userId: learner._id,
        lessonId: lesson._id,
        lastPositionSeconds: lastPos,
        watchedRanges: [{ start: 0, end: lastPos }],
        activeStudySeconds: studySeconds,
        completed: isCompleted,
        completedAt: isCompleted ? daysAgo(randomInt(1, 60)) : undefined,
        bestQuizScore: isCompleted ? randomInt(60, 100) : undefined,
      });
      totalProgress++;
    }

    // ── Saved Words (SRS) ──
    if (allWords.length > 0 && selectedLessons.length > 0) {
      const wordCount = activityLevel === 'high' ? randomInt(15, Math.min(40, allWords.length))
        : activityLevel === 'medium' ? randomInt(8, Math.min(20, allWords.length))
        : randomInt(3, Math.min(10, allWords.length));

      const selectedWords = randomPick(allWords, wordCount);
      for (const word of selectedWords) {
        const sourceLessonId = randomPick(selectedLessons, 1)[0]._id;
        const reps = randomInt(0, activityLevel === 'high' ? 8 : activityLevel === 'medium' ? 5 : 3);
        const intervalDays = reps === 0 ? 0 : Math.min(180, Math.round(2.5 ** reps));
        const ease = Number((2.5 + (Math.random() - 0.5) * 0.6).toFixed(2));

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + randomInt(-3, intervalDays));

        const ratings = ['again', 'hard', 'good', 'easy'] as const;
        const lastRating = reps === 0 ? undefined : ratings[randomInt(1, 3)]; // bias toward good/easy

        await SavedWordModel.create({
          userId: learner._id,
          wordId: word._id,
          sourceLessonId,
          sourceCueId: `cue-${randomInt(1, 20).toString().padStart(3, '0')}`,
          repetitions: reps,
          intervalDays,
          easeFactor: ease,
          nextReviewAt: nextReview,
          lastReviewedAt: reps > 0 ? daysAgo(randomInt(0, 14)) : undefined,
          lastRating,
        });
        totalSavedWords++;
      }
    }

    // ── Study Activity (streak heatmap data) ──
    const streakDays = activityLevel === 'high' ? randomInt(30, 75)
      : activityLevel === 'medium' ? randomInt(15, 40)
      : randomInt(5, 15);

    for (let d = 0; d < streakDays; d++) {
      // Some days may be skipped for realism
      if (activityLevel !== 'high' && Math.random() < 0.25) continue;

      const date = daysAgo(d);
      const studyMinutes = learnerData.dailyMinutes + randomInt(-10, 15);
      const activeSeconds = Math.max(300, studyMinutes * 60);

      await StudyActivityModel.create({
        userId: learner._id,
        dateKey: dateKey(date),
        activeStudySeconds: activeSeconds,
        progressUpdates: randomInt(1, 6),
        quizAttempts: randomInt(0, 3),
        completedLessons: Math.random() < 0.3 ? 1 : 0,
      });
      totalStudyDays++;
    }

    // ── Quiz Attempts ──
    if (allQuizzes.length > 0 && selectedLessons.length > 0) {
      const attemptCount = activityLevel === 'high' ? randomInt(5, 12)
        : activityLevel === 'medium' ? randomInt(2, 6)
        : randomInt(1, 3);

      for (let a = 0; a < attemptCount; a++) {
        // Find a quiz for one of the user's lessons
        const candidateQuiz = allQuizzes.find(q =>
          selectedLessons.some(l => l._id.toString() === q.lessonId.toString())
        );
        if (!candidateQuiz) break;

        const matchedLesson = selectedLessons.find(l => l._id.toString() === candidateQuiz.lessonId.toString());
        if (!matchedLesson) break;

        const questionCount = candidateQuiz.questions?.length || randomInt(5, 10);
        const correctCount = randomInt(
          activityLevel === 'high' ? Math.ceil(questionCount * 0.6) : Math.ceil(questionCount * 0.3),
          questionCount
        );
        const score = Math.round((correctCount / questionCount) * 100);

        // Generate answer data
        const answers = Array.from({ length: questionCount }, (_, qi) => {
          const q = candidateQuiz.questions?.[qi];
          const isCorrect = qi < correctCount;
          return {
            questionId: q?.questionId || `q-${qi + 1}`,
            selectedOptionId: q?.options?.[0]?.optionId || `opt-${randomInt(1, 4)}`,
            correct: isCorrect,
          };
        });

        try {
          await QuizAttemptModel.create({
            userId: learner._id,
            lessonId: matchedLesson._id,
            quizId: candidateQuiz._id,
            idempotencyKey: `${learner._id}-${candidateQuiz._id}-${a}-${Date.now()}`,
            answers,
            score,
            correctCount,
            totalCount: questionCount,
            createdAt: daysAgo(randomInt(1, 45)),
          });
          totalQuizAttempts++;
        } catch {
          // Skip duplicate idempotencyKey conflicts
        }
      }
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  📋 SEED SUMMARY');
  console.log('═'.repeat(65));
  console.log(`  👑 Admins created:          2`);
  console.log(`  🎓 Learners created:        20`);
  console.log(`  📺 Progress records:        ${totalProgress}`);
  console.log(`  📝 Saved words (SRS):       ${totalSavedWords}`);
  console.log(`  📅 Study activity days:     ${totalStudyDays}`);
  console.log(`  🧪 Quiz attempts:           ${totalQuizAttempts}`);
  console.log('─'.repeat(65));
  console.log(`  🔑 Shared password:         ${DEFAULT_PASSWORD}`);
  console.log(`  👑 Admin 1:                 admin@hanflix.local`);
  console.log(`  👑 Admin 2:                 quanly@hanflix.local`);
  console.log('─'.repeat(65));
  console.log('  🔒 PRESERVED DATA:');
  const vocabCount = await mongoose.connection.collection('vocabularies').countDocuments();
  const grammarCount = await mongoose.connection.collection('grammars').countDocuments();
  const lessonCount = await LessonModel.countDocuments();
  const wordCount = await WordModel.countDocuments();
  console.log(`     Vocabulary (HSK):        ${vocabCount.toLocaleString()} words`);
  console.log(`     Grammar:                 ${grammarCount} points`);
  console.log(`     Lessons:                 ${lessonCount}`);
  console.log(`     Words:                   ${wordCount}`);
  console.log('═'.repeat(65));
}

run()
  .then(() => {
    console.log('\n✅ Seed completed successfully!');
  })
  .catch((err) => {
    console.error('\n❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
