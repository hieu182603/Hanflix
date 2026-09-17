import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { LessonModel } from '../models/lesson.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { UserModel } from '../models/user.model.js';
import { WordModel } from '../models/word.model.js';

type Fixture = {
  lessons: Array<Record<string, any>>;
  cueSets: Array<Record<string, any>>;
  words: Array<Record<string, any>>;
  quizzes: Array<Record<string, any>>;
};

const objectId = (value: string) => new Types.ObjectId(createHash('sha256').update(`hanflix:${value}`).digest('hex').slice(0, 24));
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const goalMap: Record<string, string> = { business: 'work', daily: 'daily', travel: 'travel', hsk: 'hsk', culture: 'culture' };

async function run() {
  if (env.SEED_ADMIN_PASSWORD === 'ChangeMe123!') {
    throw new Error('Set a non-default SEED_ADMIN_PASSWORD before running the seed');
  }
  await connectDatabase();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.resolve(here, '../../../doc/HanFlix_04_Du_Lieu_Mau.json');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;

  const adminPasswordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
  const admin = await UserModel.findOneAndUpdate(
    { email: env.SEED_ADMIN_EMAIL },
    {
      $set: {
        name: 'HanFlix Admin', role: 'admin', status: 'active', passwordHash: adminPasswordHash,
        emailVerifiedAt: new Date(), emailVerificationRequired: false,
      },
      $setOnInsert: { learningProfile: { currentHskSource: 'unknown', subtitlePreference: 'all' } },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  for (const item of fixture.words) {
    await WordModel.findOneAndUpdate(
      { _id: objectId(item.id) },
      {
        $set: {
          hanzi: item.hanzi,
          pinyin: item.pinyin,
          meaningVi: item.meaningVi,
          partOfSpeech: item.partOfSpeech,
          examples: [],
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  for (const item of fixture.lessons) {
    const isContentReady = Boolean(item.contentReady);
    await LessonModel.findOneAndUpdate(
      { _id: objectId(`lesson:${item.id}`) },
      {
        $set: {
          slug: `${slugify(item.titleVi)}-${item.id}`,
          titleVi: item.titleVi,
          titleZh: item.titleZh,
          pinyin: item.pinyin,
          descriptionVi: item.descriptionVi,
          hsk: item.hsk,
          topicIds: item.topics,
          goalTags: item.goalTags.map((goal: string) => goalMap[goal] ?? 'other'),
          durationSeconds: item.durationSeconds,
          status: isContentReady ? 'published' : 'draft',
          activeSubtitleRevision: isContentReady ? item.publishedRevision : undefined,
          activeQuizRevision: isContentReady && item.quizId ? item.publishedRevision : undefined,
          publishedAt: isContentReady ? new Date() : undefined,
          createdBy: admin._id,
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  for (const cueSet of fixture.cueSets) {
    const lesson = fixture.lessons.find(item => item.id === cueSet.lessonId);
    const revision = lesson?.publishedRevision ?? 1;
    await SubtitleTrackModel.findOneAndUpdate(
      { lessonId: objectId(`lesson:${cueSet.lessonId}`), revision },
      {
        $set: {
          status: 'published',
          generatedBy: 'fixture',
          reviewedBy: admin._id,
          cues: cueSet.cues.map((cue: Record<string, any>) => ({
            cueId: cue.id,
            startMs: Math.round(cue.start * 1000),
            endMs: Math.round(cue.end * 1000),
            zh: cue.zh,
            pinyin: cue.pinyin,
            vi: cue.vi,
            tokens: cue.tokens.map((token: Record<string, any>) => ({
              text: token.text,
              wordId: token.wordId ? objectId(token.wordId) : null,
            })),
          })),
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  for (const quiz of fixture.quizzes) {
    const lesson = fixture.lessons.find(item => item.id === quiz.lessonId);
    const revision = lesson?.publishedRevision ?? 1;
    await QuizModel.findOneAndUpdate(
      { lessonId: objectId(`lesson:${quiz.lessonId}`), revision },
      {
        $set: {
          status: 'published',
          questions: quiz.questions.map((question: Record<string, any>) => ({
            questionId: question.id,
            type: question.type === 'multiple-choice' ? 'multiple_choice' : 'fill_blank',
            prompt: question.promptVi,
            cueId: question.cueId,
            options: (question.options ?? []).map((option: Record<string, any>) => ({ optionId: option.id, text: option.text })),
            correctOptionId: question.correctOptionId,
            acceptedAnswers: question.acceptedAnswers,
            explanationVi: question.explanationVi,
            relatedWordIds: question.relatedWordIds.map((id: string) => objectId(id)),
          })),
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  console.log(`Seeded admin ${admin.email}, ${fixture.lessons.length} lesson metadata records, ${fixture.words.length} words and fixture learning content.`);
}

run()
  .catch(error => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
