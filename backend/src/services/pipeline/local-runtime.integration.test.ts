import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import mongoose, { Types } from "mongoose"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import ffmpeg from "@ffmpeg-installer/ffmpeg"
import { env } from "../../config/env.js"
import { ProcessingJobModel } from "../../models/processing-job.model.js"
import { LessonModel } from "../../models/lesson.model.js"
import { SubtitleTrackModel } from "../../models/subtitle-track.model.js"
import { QuizModel } from "../../models/quiz.model.js"
import {
  addVideoProcessingJob,
  claimNextVideoProcessingJob,
  heartbeatProcessingJob,
  failOrRequeueVideoProcessingJob,
  retryVideoProcessingJob,
} from "../../queue/video.queue.js"
import { DurableSteps } from "./durable-steps.js"
import { startProcessingStep, completeProcessingStep } from "./processing-steps.js"
import { runGenerationCommit } from "../revision-commit.js"
import {
  extractAudioForASR,
  extractAudioForSeparation,
  validateAsrAudio,
  probeMedia,
} from "../media-processor.js"

describe.skipIf(process.env.RUN_LOCAL_PIPELINE_INTEGRATION_TESTS !== "true")(
  "local MongoDB and FFmpeg (no cloud)",
  () => {
    const dbName = `hanflix_pipeline_audit_${process.pid}_${Date.now()}`
    let temp = ""
    beforeAll(async () => {
      await mongoose.connect(
        `mongodb://127.0.0.1:27029/${dbName}?replicaSet=pipelineAudit`,
        { serverSelectionTimeoutMS: 5000 },
      )
      await Promise.all([
        LessonModel.init(),
        ProcessingJobModel.init(),
        SubtitleTrackModel.init(),
        QuizModel.init(),
      ])
      temp = await fs.mkdtemp(path.join(os.tmpdir(), "hanflix-pipeline-test-"))
    })
    afterAll(async () => {
      vi.restoreAllMocks()
      if (
        mongoose.connection.db?.databaseName === dbName &&
        dbName.startsWith("hanflix_pipeline_audit_")
      )
        await mongoose.connection.dropDatabase()
      await mongoose.disconnect()
      if (temp) await fs.rm(temp, { recursive: true, force: true })
    })
    const lesson = () =>
      LessonModel.create({
        slug: `audit-${new Types.ObjectId()}`,
        titleVi: "Audit",
        descriptionVi: "Local test",
        hsk: 1,
        durationSeconds: 2,
        createdBy: new Types.ObjectId(),
        contentMode: "song",
        status: "processing",
      })
    it("claims once under duplicate delivery and rejects stale-worker writes after restart", async () => {
      const doc = await lesson()
      const jobs = await Promise.all([
        addVideoProcessingJob({
          lessonId: String(doc._id),
          objectKey: "test.mp4",
        }),
        addVideoProcessingJob({
          lessonId: String(doc._id),
          objectKey: "test.mp4",
        }),
      ])
      expect(String(jobs[0]!._id)).toBe(String(jobs[1]!._id))
      const claims = await Promise.all([
        claimNextVideoProcessingJob("A"),
        claimNextVideoProcessingJob("B"),
      ])
      const claimed = claims.find(Boolean)!
      expect(claims.filter(Boolean)).toHaveLength(1)
      const downloadStep = { ...claimed, step: "DOWNLOAD_SOURCE" as const }
      expect(await startProcessingStep(downloadStep)).toBe(true)
      expect(await startProcessingStep(downloadStep)).toBe(true)
      expect(await completeProcessingStep(downloadStep)).toBe(true)
      expect((await ProcessingJobModel.findById(claimed.jobId).lean())?.steps.DOWNLOAD_SOURCE.attempt).toBe(2)
      const steps = new DurableSteps(
        claimed,
        new AbortController().signal,
        {},
        {},
        async () => {},
      )
      await steps.run("PRIMARY_TRANSCRIPTION", async () => ["cached"])
      await ProcessingJobModel.updateOne({ _id: claimed.jobId }, {
        $set: { leaseExpiresAt: new Date(0) },
      })
      expect(await heartbeatProcessingJob(claimed)).toBe(false)
      expect(await claimNextVideoProcessingJob("C")).not.toBeNull()
      expect(await heartbeatProcessingJob(claimed)).toBe(false)
      expect(await completeProcessingStep(downloadStep)).toBe(false)
      await expect(steps.save("stale", true)).rejects.toMatchObject({
        code: "LEASE_REVOKED",
      })
      expect(
        await failOrRequeueVideoProcessingJob(
          claimed.jobId,
          "STALE",
          "old error",
          claimed.leaseToken,
        ),
      ).toBeNull()
      const persisted = await ProcessingJobModel.findById(claimed.jobId).lean()
      expect(persisted?.steps.PRIMARY_TRANSCRIPTION.output.value).toEqual([
        "cached",
      ])
      await ProcessingJobModel.updateOne({ _id: claimed.jobId }, {
        $set: { status: "completed" },
        $unset: { activeKey: 1 },
      })
    })
    it("blocks retry during artifact cleanup and preserves paid checkpoints after the lock expires", async () => {
      const doc = await lesson()
      const job = await ProcessingJobModel.create({
        lessonId: doc._id,
        status: "failed",
        objectKey: "test.mp4",
        artifactCleanupLockUntil: new Date(Date.now() + 600000),
        checkpoint: { primary: { submissionStarted: true, transcriptionUrl: "https://speech.example/transcriptions/one" } },
      })
      expect(await retryVideoProcessingJob(String(doc._id), "test.mp4")).toBeNull()
      await ProcessingJobModel.updateOne({ _id: job._id }, { $set: { artifactCleanupLockUntil: new Date(0) } })
      const retried = await retryVideoProcessingJob(String(doc._id), "test.mp4")
      expect(retried?.status).toBe("queued")
      expect(retried?.checkpoint.primary.submissionStarted).toBe(true)
      await ProcessingJobModel.updateOne({ _id: job._id }, { $set: { status: "completed" }, $unset: { activeKey: 1 } })
    })
    it.each([false, true])(
      "persists karaoke and stable revisions with disableTransactions=%s",
      async (standalone) => {
        env.DISABLE_TRANSACTIONS = standalone
        const doc = await lesson()
        const job = await ProcessingJobModel.create({
          lessonId: doc._id,
          status: "running",
          leaseToken: "test-lease",
          leaseExpiresAt: new Date(Date.now() + 120000),
        })
        const input = {
          lessonId: String(doc._id),
          jobId: String(job._id),
          leaseToken: "test-lease",
          durationSeconds: 2,
          questions: [],
          cues: [
            {
              cueId: "c1",
              startMs: 0,
              endMs: 1000,
              zh: "你好",
              pinyin: "nǐ hǎo",
              vi: "Xin chào",
              rawText: "你好",
              normalizedText: "你好",
              needsFineAlignment: true,
              karaokeTokens: [
                {
                  text: "你",
                  pinyin: "nǐ",
                  startMs: 0,
                  endMs: 500,
                  approximate: true,
                  timingSource: "INTERPOLATED" as const,
                },
                {
                  text: "好",
                  pinyin: "hǎo",
                  startMs: 500,
                  endMs: 1000,
                  approximate: true,
                  timingSource: "INTERPOLATED" as const,
                },
              ],
            },
          ],
        }
        if (standalone) {
          const failure = vi
            .spyOn(QuizModel, "findOneAndUpdate")
            .mockRejectedValueOnce(new Error("simulated partial write"))
          await expect(runGenerationCommit(input)).rejects.toThrow(
            "simulated partial write",
          )
          failure.mockRestore()
        }
        await runGenerationCommit(input)
        expect(
          await SubtitleTrackModel.countDocuments({ lessonId: doc._id }),
        ).toBe(1)
        const saved = await SubtitleTrackModel.findOne({
          lessonId: doc._id,
        }).lean()
        expect(saved?.revision).toBe(1)
        expect(saved?.cues[0]?.karaokeTokens?.[0]).toMatchObject({
          pinyin: "nǐ",
          approximate: true,
          timingSource: "INTERPOLATED",
        })
        expect((await LessonModel.findById(doc._id))?.status).toBe(
          "ready_for_review",
        )
        expect((await ProcessingJobModel.findById(job._id))?.status).toBe(
          "completed",
        )
        await expect(runGenerationCommit(input)).rejects.toMatchObject({
          code: "LEASE_REVOKED",
        })
        expect(
          await SubtitleTrackModel.countDocuments({ lessonId: doc._id }),
        ).toBe(1)
      },
    )
    it("validates real FFmpeg formats and rejects corrupt or over-budget input", async () => {
      const source = path.join(temp, "source.wav"),
        asr = path.join(temp, "asr.wav"),
        separation = path.join(temp, "separation.wav")
      await promisify(execFile)(
        ffmpeg.path,
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=2",
          "-ar",
          "48000",
          "-ac",
          "2",
          source,
        ],
        { windowsHide: true },
      )
      await extractAudioForSeparation(source, separation)
      expect((await probeMedia(separation)).sampleRate).toBe(44100)
      await extractAudioForASR(source, asr)
      expect(await validateAsrAudio(asr)).toMatchObject({
        sampleRate: 16000,
        channels: 1,
        audioCodec: "pcm_s16le",
        durationSeconds: 2,
      })
      await expect(validateAsrAudio(source)).rejects.toMatchObject({
        code: "INVALID_ASR_AUDIO",
      })
      await expect(
        probeMedia(source, undefined, { maxDurationSeconds: 1 }),
      ).rejects.toMatchObject({ code: "VIDEO_DURATION_EXCEEDED" })
      const corrupt = path.join(temp, "corrupt.wav")
      await fs.writeFile(corrupt, "bad audio")
      await expect(validateAsrAudio(corrupt)).rejects.toMatchObject({
        code: "MEDIA_PROBE_FAILED",
      })
    })
  },
)
