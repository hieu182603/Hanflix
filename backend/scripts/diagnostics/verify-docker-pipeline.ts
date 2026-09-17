import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { LessonModel } from '../../src/models/lesson.model.js';
import { ProcessingJobModel } from '../../src/models/processing-job.model.js';
import { QuizModel } from '../../src/models/quiz.model.js';
import { SubtitleTrackModel } from '../../src/models/subtitle-track.model.js';
import { VocabularyModel } from '../../src/models/vocabulary.model.js';
import { WordModel } from '../../src/models/word.model.js';
import { addVideoProcessingJob } from '../../src/queue/video.queue.js';
import { storageService } from '../../src/services/storage/r2-storage.service.js';

const runId = process.env.HANFLIX_VERIFY_RUN_ID;
const mode = process.argv[2];
if (!runId || !/^[a-z0-9-]{8,40}$/.test(runId)) throw new Error('Set HANFLIX_VERIFY_RUN_ID to a unique lowercase test ID');
if (env.MONGODB_DB_NAME !== `hanflix_codex_verify_${runId.replaceAll('-', '_')}`) {
  throw new Error('MONGODB_DB_NAME must be the isolated hanflix_codex_verify_<run-id> database');
}
if (!['prepare', 'status', 'reset', 'enqueue-failure', 'cleanup'].includes(mode ?? '')) throw new Error('Mode must be prepare, status, reset, enqueue-failure or cleanup');

const slug = `codex-docker-verify-${runId}`;
const retrySlug = `${slug}-retry`;
const objectKey = `diagnostics/${slug}.mp4`;
const run = promisify(execFile);

async function prepare() {
  if (await LessonModel.countDocuments() || await ProcessingJobModel.countDocuments()) {
    throw new Error('Diagnostic database is not empty; refusing to overwrite it');
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanflix-docker-verify-'));
  let uploaded = false;
  try {
    const speech = await fetch(`https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'HanflixDockerVerify',
      },
      body: '<speak version="1.0" xml:lang="zh-CN"><voice name="zh-CN-XiaoxiaoNeural">你好，欢迎学习中文。今天我们一起学习汉语。请跟我读：你好，你好。</voice></speak>',
    });
    if (!speech.ok) throw new Error(`Azure TTS returned ${speech.status}`);
    const audioPath = path.join(tempDir, 'speech.mp3');
    const videoPath = path.join(tempDir, 'video.mp4');
    await fs.writeFile(audioPath, Buffer.from(await speech.arrayBuffer()));
    await run(ffmpegInstaller.path, [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=15',
      '-i', audioPath, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
      '-movflags', '+faststart', videoPath,
    ]);
    const video = await fs.readFile(videoPath);
    const { uploadUrl } = await storageService.createUploadUrl(objectKey, 'video/mp4');
    const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video });
    if (!upload.ok) throw new Error(`R2 upload returned ${upload.status}`);
    uploaded = true;
    await VocabularyModel.create({ simplified: '你', pinyin: 'nǐ', meanings: { vi: ['bạn'] }, hskLevel: 1, status: 'published' });
    const lesson = await LessonModel.create({
      slug, titleVi: 'Kiểm thử Docker', descriptionVi: 'Bài học chẩn đoán tự động', hsk: 1,
      topicIds: ['diagnostic'], durationSeconds: 60, status: 'processing', processingStatus: 'QUEUED',
      processingStep: 'QUEUED', createdBy: new Types.ObjectId(),
      media: { objectKey, mimeType: 'video/mp4', sizeBytes: video.byteLength },
    });
    const job = await addVideoProcessingJob({ lessonId: lesson._id.toString(), objectKey });
    console.log(JSON.stringify({ database: env.MONGODB_DB_NAME, lessonId: lesson._id, jobId: job._id, videoBytes: video.byteLength }));
  } catch (error) {
    if (uploaded) await storageService.deleteObject(objectKey);
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function status() {
  const lesson = await LessonModel.findOne({ slug }).lean();
  const job = lesson && await ProcessingJobModel.findOne({ lessonId: lesson._id }).lean();
  const track = lesson && await SubtitleTrackModel.findOne({ lessonId: lesson._id }).lean();
  const quiz = lesson && await QuizModel.findOne({ lessonId: lesson._id }).lean();
  const ids = [...new Set(track?.cues.flatMap(cue => cue.tokens.map(token => token.wordId?.toString()).filter(Boolean)) ?? [])];
  const words = await WordModel.find({ _id: { $in: ids } }).select('_id hanzi').lean();
  const hsk = await VocabularyModel.findOne({ simplified: '你' }).lean();
  const retryLesson = await LessonModel.findOne({ slug: retrySlug }).lean();
  const retryJob = retryLesson && await ProcessingJobModel.findOne({ lessonId: retryLesson._id }).lean();
  const result = {
    lessonStatus: lesson?.status, jobStatus: job?.status, jobStage: job?.stage,
    attempts: job?.attempts, errorCode: job?.errorCode, errorMessage: job?.errorMessage,
    cues: track?.cues.length ?? 0, quizQuestions: quiz?.questions.length ?? 0,
    referencedWordIds: ids.length, resolvedWordIds: words.length,
    hskWordMirrored: words.some(word => word.hanzi === '你' && word._id.toString() !== hsk?._id.toString()),
    retryJobStatus: retryJob?.status, retryAttempts: retryJob?.attempts, retryErrorCode: retryJob?.errorCode,
  };
  console.log(JSON.stringify(result));
  if (job?.status === 'completed' && (lesson?.status !== 'ready_for_review' || !track?.cues.length || ids.length !== words.length)) process.exitCode = 1;
}

async function cleanup() {
  const lessons = await LessonModel.find().select('slug').lean();
  if (lessons.some(lesson => ![slug, retrySlug].includes(lesson.slug)) || lessons.length > 2) {
    throw new Error('Diagnostic database contains unexpected lessons; refusing cleanup');
  }
  await storageService.deleteObject(objectKey);
  const collections = await LessonModel.db.db!.listCollections().toArray();
  if (collections.some(collection => !['lessons', 'processingjobs', 'subtitletracks', 'quizzes', 'words', 'vocabularies'].includes(collection.name))) {
    throw new Error('Diagnostic database contains unexpected collections; refusing database cleanup');
  }
  await LessonModel.db.dropDatabase();
  console.log(JSON.stringify({ removedDiagnosticDatabase: env.MONGODB_DB_NAME, removedDiagnosticObject: objectKey }));
}

async function enqueueFailure() {
  const primary = await LessonModel.findOne({ slug });
  if (primary?.status !== 'ready_for_review') throw new Error('Successful diagnostic job must complete before retry test');
  if (await LessonModel.exists({ slug: retrySlug })) throw new Error('Retry diagnostic already exists');
  const lesson = await LessonModel.create({
    slug: retrySlug, titleVi: 'Kiểm thử retry Docker', descriptionVi: 'R2 object cố ý không tồn tại',
    hsk: 1, topicIds: ['diagnostic'], durationSeconds: 60, status: 'processing',
    processingStatus: 'QUEUED', processingStep: 'QUEUED', createdBy: new Types.ObjectId(),
  });
  const job = await addVideoProcessingJob({ lessonId: lesson._id.toString(), objectKey: `diagnostics/${retrySlug}-missing.mp4` });
  console.log(JSON.stringify({ retryLessonId: lesson._id, retryJobId: job._id }));
}

async function reset() {
  const lesson = await LessonModel.findOne({ slug });
  if (!lesson) throw new Error('Diagnostic lesson not found');
  const job = await ProcessingJobModel.findOne({ lessonId: lesson._id });
  if (!job || !['queued', 'failed'].includes(job.status)) throw new Error('Diagnostic job is running or missing; refusing reset');
  job.status = 'queued';
  job.attempts = 0;
  job.activeKey = `lesson:${lesson._id}`;
  job.nextAttemptAt = new Date();
  job.lockedAt = undefined;
  job.lockedBy = undefined;
  job.heartbeatAt = undefined;
  job.errorCode = undefined;
  job.errorMessage = undefined;
  job.completedAt = undefined;
  await job.save();
  await LessonModel.findByIdAndUpdate(lesson._id, { $set: { status: 'processing', processingStatus: 'QUEUED', processingStep: 'QUEUED' }, $unset: { processingError: 1 } });
  console.log(JSON.stringify({ resetDiagnosticJob: job._id, database: env.MONGODB_DB_NAME }));
}

async function main() {
  await connectDatabase();
  try {
    if (mode === 'prepare') await prepare();
    if (mode === 'status') await status();
    if (mode === 'reset') await reset();
    if (mode === 'enqueue-failure') await enqueueFailure();
    if (mode === 'cleanup') await cleanup();
  } finally {
    await disconnectDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
