import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { LessonModel } from '../src/models/lesson.model.js';
import { ProcessingJobModel } from '../src/models/processing-job.model.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const lessons = await LessonModel.find({ contentMode: 'song' })
    .select('_id titleVi contentMode status lyricsRaw')
    .limit(10)
    .lean();
  console.log('SONG LESSONS:');
  for (const l of lessons) {
    console.log({ id: String(l._id), title: l.titleVi, status: l.status, hasLRC: Boolean(l.lyricsRaw && l.lyricsRaw.trim().length) });
  }
  const jobs = await ProcessingJobModel.find({ status: { $in: ['queued', 'running', 'failed'] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  console.log('RECENT JOBS:', JSON.stringify(jobs, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
