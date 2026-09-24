import { beforeEach, expect, it, vi } from "vitest"
import { env } from "../../config/env.js"
import { AppError } from "../../errors/app-error.js"
import { processPipelineV2 } from "./video-pipeline-v2.js"
import { DurableSteps } from "./durable-steps.js"
import {
  prepareCues,
  enrichPreparedCues,
  validateFinalCues,
  estimateProcessingUsage,
} from "./subtitle-quality.js"
import { segmentTokens } from "../pinyin.js"
const mocks = vi.hoisted(() => ({
  job: {} as any,
  lesson: {} as any,
  objects: new Set<string>(),
  asr: vi.fn(),
  demucs: vi.fn(),
  translate: vi.fn(),
  commit: vi.fn(),
  vocabulary: vi.fn(),
  probe: vi.fn(),
  extract: vi.fn(),
  update: vi.fn(),
  failLease: false,
}))
vi.mock("../../models/lesson.model.js", () => ({
  LessonModel: { findById: async () => mocks.lesson, updateOne: vi.fn() },
}))
vi.mock("../../models/processing-job.model.js", () => ({
  ProcessingJobModel: {
    findById: () => ({ lean: async () => structuredClone(mocks.job) }),
    updateOne: (...args: unknown[]) => mocks.update(...args),
  },
}))
vi.mock("../../queue/video.queue.js", () => ({
  transitionStage: async () => !mocks.failLease,
  STAGE_DEADLINES_MS: {
    inspect_media: 60000,
    transcribe_zh: 900000,
    finalize: 60000,
    translate_vi: 60000,
    extract_vocabulary: 60000,
  },
}))
vi.mock("../media-processor.js", () => ({
  probeMedia: (...a: unknown[]) => mocks.probe(...a),
  extractAudioForASR: (...a: unknown[]) => mocks.extract(...a),
  validateAsrAudio: vi.fn(),
  extractAudioForSeparation: vi.fn(),
  generateThumbnail: vi.fn().mockResolvedValue("/tmp/thumb.jpg"),
}))
vi.mock("../r2.js", () => ({
  confirmR2Object: async (key: string) => {
    if (!mocks.objects.has(key))
      throw Object.assign(new Error(), { name: "NotFound" })
    return { sizeBytes: 1000 }
  },
  createVideoDownloadUrl: async () => "https://r2.example/signed",
  downloadR2Object: vi.fn(),
  uploadR2File: async (key: string) => {
    mocks.objects.add(key)
  },
}))
vi.mock("../speech/azure-speech-batch.service.js", async (original) => ({
  ...(await original<typeof import("../speech/azure-speech-batch.service.js")>()),
  azureSpeechBatchWhisperProvider: {
    transcribeFromUrl: (...a: unknown[]) => mocks.asr(...a),
  },
}))
vi.mock("../media-compute.js", () => ({
  mediaComputeProvider: {
    separateVocals: (...a: unknown[]) => mocks.demucs(...a),
  },
}))
vi.mock("../translator.js", () => ({
  translationService: {
    translateChineseToVietnamese: (...a: unknown[]) => mocks.translate(...a),
  },
}))
vi.mock("../learning-word.js", () => ({
  resolveLearningWordIds: (...a: unknown[]) => mocks.vocabulary(...a),
}))
vi.mock("../revision-commit.js", () => ({
  runGenerationCommit: (...a: unknown[]) => mocks.commit(...a),
}))
vi.mock("../podcast/chapter-detector.service.js", () => ({
  detectChapters: async () => [
    { chapterId: "ch1", title: "Phần 1", startMs: 0, endMs: 10000 },
  ],
}))
vi.mock("node:fs/promises", () => ({
  default: { writeFile: vi.fn(), rm: vi.fn() },
}))
const get = (obj: any, key: string) =>
  key.split(".").reduce((v, k) => v?.[k], obj)
const set = (obj: any, key: string, value: unknown) => {
  const keys = key.split(".")
  const last = keys.pop()!
  for (const k of keys) obj = obj[k] ??= {}
  obj[last] = structuredClone(value)
}
const lease = {
  jobId: "job",
  lessonId: "lesson",
  objectKey: "source",
  leaseToken: "lease",
  leaseExpiresAt: new Date(Date.now() + 60000),
}
const run = () =>
  processPipelineV2("lesson", "job", "/tmp/source.mp4", {
    lease,
    signal: new AbortController().signal,
    rearmDeadline: vi.fn(),
  })
const good = [{ text: "你好世界我们学习中文", startMs: 0, endMs: 9500 }]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.objects.clear()
  mocks.failLease = false
  mocks.job = {
    pipelineVersion: 2,
    status: "running",
    steps: {},
    checkpoint: {},
    processingMetrics: {},
  }
  mocks.lesson = {
    contentMode: "lesson",
    mediaType: "MOVIE",
    thumbnailKey: "thumb",
    hsk: 1,
  }
  env.VIDEO_PROCESSING_PIPELINE_V2 = true
  env.AZURE_SPEECH_BATCH_ENABLED = true
  env.MEDIA_COMPUTE_PROVIDER = "local"
  env.MUSIC_PRESEPARATE_VOCALS = false
  env.PLAYBACK_DERIVATIVE_ENABLED = false
  mocks.update.mockImplementation(async (filter, update) => {
    if (mocks.failLease) return { matchedCount: 0 }
    for (const [key, value] of Object.entries(filter))
      if (
        key.startsWith("checkpoint.") &&
        (value as any)?.$ne === get(mocks.job, key)
      )
        return { matchedCount: 0 }
    for (const [key, value] of Object.entries(update.$set ?? {}))
      set(mocks.job, key, value)
    for (const [key, value] of Object.entries(update.$inc ?? {}))
      set(mocks.job, key, (get(mocks.job, key) ?? 0) + Number(value))
    return { matchedCount: 1 }
  })
  mocks.probe.mockResolvedValue({
    durationSeconds: 10,
    audioCodec: "aac",
    width: 1280,
    height: 720,
  })
  mocks.extract.mockResolvedValue("/tmp/asr.wav")
  mocks.demucs.mockResolvedValue(undefined)
  mocks.asr.mockImplementation(async (_url, _signal, state) => {
    if (!state.submissionStarted) await state.beforeSubmit()
    await state.onSubmitted("https://azure.example/transcriptions/one")
    return { segments: good }
  })
  mocks.translate.mockImplementation(async (texts) =>
    texts.map(() => "Xin chào"),
  )
  mocks.vocabulary.mockResolvedValue(new Map())
  mocks.commit.mockResolvedValue({})
})
it.each(["lesson", "podcast", "drama", "song"])(
  "completes %s through shared V2 checkpoints with persisted karaoke",
  async (mode) => {
    mocks.lesson.contentMode = mode
    await run()
    expect(mocks.asr).toHaveBeenCalledOnce()
    expect(mocks.demucs).not.toHaveBeenCalled()
    const input = mocks.commit.mock.calls[0]![0]
    expect(input.cues[0].karaokeTokens[0]).toMatchObject({
      approximate: true,
      timingSource: "INTERPOLATED",
    })
    expect(mocks.job.steps.TRANSLATE.status).toBe("COMPLETED")
    expect(mocks.job.processingMetrics.azureAsrRequests).toBe(1)
    if (mode === "podcast") expect(input.chapters).toHaveLength(1)
  },
)
it("restarts after translation rejection without repeating FFmpeg or ASR or completed steps", async () => {
  mocks.translate.mockRejectedValueOnce(
    new AppError(502, "FAILED_TRANSLATION", "HTTP 401"),
  )
  await expect(run()).rejects.toThrow("HTTP 401")
  await run()
  expect(mocks.asr).toHaveBeenCalledOnce()
  expect(mocks.extract).toHaveBeenCalledOnce()
  expect(mocks.job.steps.TRANSLATE.attempt).toBe(2)
})
it("blocks uncertain Translator delivery instead of double billing", async () => {
  mocks.translate.mockRejectedValueOnce(
    new AppError(502, "TRANSLATION_SUBMISSION_UNCERTAIN", "network"),
  )
  await expect(run()).rejects.toThrow("network")
  await expect(run()).rejects.toMatchObject({
    code: "TRANSLATION_SUBMISSION_UNCERTAIN",
  })
  expect(mocks.translate).toHaveBeenCalledOnce()
  expect(mocks.asr).toHaveBeenCalledOnce()
})
it("does not let vocabulary failure block review", async () => {
  mocks.vocabulary.mockRejectedValue(new Error("DB unavailable"))
  await run()
  expect(mocks.commit).toHaveBeenCalledOnce()
  expect(mocks.job.checkpoint.warnings.join()).toContain(
    "VOCABULARY_UNAVAILABLE",
  )
})
it("bad music triggers Demucs and secondary once, poor secondary stays reviewable", async () => {
  mocks.lesson.mediaType = "MUSIC"
  mocks.asr.mockImplementation(async (_url, _signal, state) => {
    if (!state.submissionStarted) await state.beforeSubmit()
    return { segments: [{ text: "谢谢观看", startMs: 0, endMs: 500 }] }
  })
  await run()
  await run()
  expect(mocks.demucs).toHaveBeenCalledOnce()
  expect(mocks.asr).toHaveBeenCalledTimes(2)
  expect(mocks.job.processingMetrics.demucsRuns).toBe(1)
  expect(mocks.job.processingMetrics.azureAsrRequests).toBe(2)
  expect(mocks.job.checkpoint.warnings.join()).toContain("NEEDS_REVIEW")
})
it("preseparates music only once and never adds a secondary run", async () => {
  mocks.lesson.mediaType = "MUSIC"
  env.MUSIC_PRESEPARATE_VOCALS = true
  await run()
  expect(mocks.demucs).toHaveBeenCalledOnce()
  expect(mocks.asr).toHaveBeenCalledOnce()
})
it("movie with bad background-music transcript does not run Demucs by default", async () => {
  mocks.asr.mockResolvedValue({
    segments: [{ text: "谢谢观看", startMs: 0, endMs: 500 }],
  })
  await run()
  expect(mocks.demucs).not.toHaveBeenCalled()
})
it("silence and corrupt media never create fake subtitles", async () => {
  mocks.asr.mockRejectedValue(
    new AppError(502, "AZURE_ASR_EMPTY_TRANSCRIPT", "silence"),
  )
  await expect(run()).rejects.toThrow("silence")
  expect(mocks.commit).not.toHaveBeenCalled()
  mocks.probe.mockRejectedValue(
    new AppError(422, "MEDIA_PROBE_FAILED", "corrupt"),
  )
  await expect(run()).rejects.toThrow("corrupt")
})
it.each([300, 600])("propagates the configured %i-second budget into media validation", async (limit) => {
  const previousLimit = env.MAX_VIDEO_DURATION_SECONDS
  env.MAX_VIDEO_DURATION_SECONDS = limit
  try {
    mocks.probe.mockRejectedValue(
      new AppError(413, "VIDEO_DURATION_EXCEEDED", `${limit + 1}s`),
    )
    await expect(run()).rejects.toThrow(`${limit + 1}s`)
    expect(mocks.probe).toHaveBeenCalledWith(
      "/tmp/source.mp4",
      expect.anything(),
      { maxDurationSeconds: limit },
    )
    expect(mocks.asr).not.toHaveBeenCalled()
  } finally {
    env.MAX_VIDEO_DURATION_SECONDS = previousLimit
  }
})
it("lease loss prevents expensive work and final commit", async () => {
  mocks.failLease = true
  await expect(run()).rejects.toMatchObject({ code: "LEASE_REVOKED" })
  expect(mocks.asr).not.toHaveBeenCalled()
  expect(mocks.commit).not.toHaveBeenCalled()
})
it("requires Batch explicitly instead of silent legacy fallback", async () => {
  env.AZURE_SPEECH_BATCH_ENABLED = false
  await expect(run()).rejects.toMatchObject({ code: "BATCH_REQUIRED_FOR_V2" })
  expect(mocks.asr).not.toHaveBeenCalled()
})
it("retains provided LRC on ASR failure", async () => {
  mocks.lesson.contentMode = "song"
  mocks.lesson.lyricsRaw = "[00:00.00]你好世界"
  mocks.asr.mockRejectedValue(new Error("asr unavailable"))
  await run()
  expect(mocks.commit.mock.calls[0]![0].cues[0].zh).toBe("你好世界")
})
it("never runs completed or skipped durable work and increments abandoned attempts", async () => {
  const steps = new DurableSteps(
    lease,
    new AbortController().signal,
    { TRANSLATE: { status: "RUNNING", attempt: 1 } },
    {},
    async () => {},
  )
  const work = vi.fn().mockResolvedValue("done")
  expect(await steps.run("TRANSLATE", work)).toBe("done")
  await steps.run("TRANSLATE", work)
  expect(work).toHaveBeenCalledOnce()
  expect(steps.steps.TRANSLATE?.attempt).toBe(2)
  await steps.skip("ALIGN_TIMESTAMPS", "unavailable")
  await steps.run("ALIGN_TIMESTAMPS", work)
  expect(work).toHaveBeenCalledOnce()
})
it("preserves contextual Pinyin for mixed Chinese/English and validates final token boundaries", () => {
  expect(segmentTokens("银行行长")[1]?.pinyin).toBe("háng")
  expect(
    segmentTokens("我爱 OpenAI，中国")
      .map((t) => t.text)
      .join(""),
  ).toBe("我爱 OpenAI，中国")
  const cues = enrichPreparedCues(
    prepareCues([{ text: "我爱 OpenAI，中国", startMs: 0, endMs: 3000 }], 3000),
  ).map((c) => ({ ...c, vi: "Tôi yêu" }))
  expect(validateFinalCues(cues, 3000).cueCount).toBeGreaterThan(0)
  cues[0]!.karaokeTokens[0]!.endMs = 9000
  expect(() => validateFinalCues(cues, 3000)).toThrow("Token")
  expect(estimateProcessingUsage(420, true)).toMatchObject({
    azureAsrRequests: 2,
    azureAsrAudioSeconds: 840,
    demucsRuns: 1,
    alignmentRuns: 0,
  })
})
