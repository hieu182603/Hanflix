import fs from "node:fs/promises"
import path from "node:path"
import { Types } from "mongoose"
import { env } from "../../config/env.js"
import { AppError } from "../../errors/app-error.js"
import { LessonModel } from "../../models/lesson.model.js"
import { ProcessingJobModel } from "../../models/processing-job.model.js"
import { transitionStage, STAGE_DEADLINES_MS } from "../../queue/video.queue.js"
import type { PipelineOptions, PipelineStage } from "../subtitle-pipeline.js"
import {
  probeMedia,
  extractAudioForASR,
  extractAudioForSeparation,
  generateThumbnail,
  validateAsrAudio,
} from "../media-processor.js"
import {
  confirmR2Object,
  createVideoDownloadUrl,
  downloadR2Object,
  uploadR2File,
} from "../r2.js"
import {
  azureSpeechBatchWhisperProvider,
  parseBatchTranscriptionResult,
  sanitizeProviderMessage,
} from "../speech/azure-speech-batch.service.js"
import type { SpeechSegment } from "../speech/speech-to-text.service.js"
import { mediaComputeProvider } from "../media-compute.js"
import { translationService } from "../translator.js"
import { resolveLearningWordIds } from "../learning-word.js"
import { resolveQuestionCount } from "../auto-quiz-generator.js"
import {
  runGenerationCommit,
  type SubtitleCueInput,
} from "../revision-commit.js"
import { evaluateTranscription } from "./asr-quality.js"
import { DurableSteps } from "./durable-steps.js"
import {
  PROCESSING_STEPS,
  type ProcessingStepName,
  type ProcessingStepsState,
} from "./processing-steps.js"
import {
  prepareCues,
  enrichPreparedCues,
  validateFinalCues,
  estimateProcessingUsage,
} from "./subtitle-quality.js"
import { migrateLegacyCheckpoints } from "./checkpoint-migration.js"
import {
  generatePlaybackDerivative,
  PLAYBACK_DERIVATIVE_VERSION,
} from "../playback-derivative.js"

const stageFor = (step: ProcessingStepName): PipelineStage =>
  step.includes("TRANSCRIPTION") || step === "SEPARATE_VOCALS"
    ? "transcribe_zh"
    : step === "TRANSLATE"
      ? "translate_vi"
      : step === "EXTRACT_VOCABULARY"
        ? "extract_vocabulary"
        : step === "EXTRACT_AUDIO" || step === "DOWNLOAD_SOURCE"
          ? "inspect_media"
          : "finalize"
const publicStepFor = (step: ProcessingStepName) =>
  step === "EXTRACT_AUDIO"
    ? "EXTRACTING_AUDIO"
    : step.includes("TRANSCRIPTION") || step === "SEPARATE_VOCALS"
      ? "TRANSCRIBING"
      : step === "GENERATE_PINYIN"
        ? "GENERATING_PINYIN"
        : step === "TRANSLATE"
          ? "TRANSLATING"
          : "SAVING"
export async function processPipelineV2(
  lessonId: string,
  jobId: string,
  source: string,
  options: PipelineOptions,
): Promise<void> {
  const { lease, signal } = options
  const [lesson, job] = await Promise.all([
    LessonModel.findById(lessonId),
    ProcessingJobModel.findById(jobId).lean(),
  ])
  if (!lesson || !job)
    throw new AppError(
      404,
      "PROCESSING_JOB_NOT_FOUND",
      "Không tìm thấy bài học hoặc job",
    )
  if (!env.AZURE_SPEECH_BATCH_ENABLED)
    throw new AppError(
      503,
      "BATCH_REQUIRED_FOR_V2",
      "Pipeline V2 yêu cầu AZURE_SPEECH_BATCH_ENABLED=true",
    )
  const prefix = `processing/${lessonId}/${jobId}/v${job.pipelineVersion ?? 2}`
  const temp = path.dirname(source)
  const warnings: string[] = Array.isArray(job.checkpoint?.warnings)
    ? [...job.checkpoint.warnings]
    : []
  const migrated = migrateLegacyCheckpoints(
    (job.steps ?? {}) as ProcessingStepsState,
    job.checkpoint ?? {},
    job.artifacts ?? {},
  )
  const steps = new DurableSteps(
    lease,
    signal,
    migrated.steps,
    job.checkpoint ?? {},
    async (step) => {
      const stage = stageFor(step)
      const progress = Math.round(
        (PROCESSING_STEPS.indexOf(step) / PROCESSING_STEPS.length) * 95,
      )
      if (!(await transitionStage(lease, stage, progress)))
        throw new AppError(409, "LEASE_REVOKED", "Lease đã bị thu hồi")
      options.rearmDeadline(STAGE_DEADLINES_MS[stage])
      await LessonModel.updateOne({ _id: lessonId }, {
        $set: {
          status: "processing",
          processingStatus: "PROCESSING",
          processingProgress: progress,
          processingStep: publicStepFor(step),
        },
      })
    },
  )
  await steps.write({ steps: migrated.steps })
  const warn = async (message: string) => {
    if (!warnings.includes(message)) warnings.push(message)
    await steps.save("warnings", warnings)
  }
  const artifact = async (name: string, local: string, contentType: string) => {
    const key = `${prefix}/${name}`
    await steps.write({
      [`artifacts.${name.replace(/[^a-z0-9]/gi, "_")}`]: key,
    })
    await uploadR2File(key, local, contentType)
    return key
  }
  const exists = async (key: string) => {
    try {
      return (await confirmR2Object(key)).sizeBytes > 0
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404 ||
        (error as Error).name === "NotFound"
      )
        return false
      throw error
    }
  }
  // Metadata is cheap to re-probe after a process restart; no paid provider or FFmpeg transform repeats.
  const metadata = await probeMedia(source, signal, {
    maxDurationSeconds: env.MAX_VIDEO_DURATION_SECONDS,
  })
  if (!metadata.audioCodec)
    throw new AppError(
      422,
      "MEDIA_AUDIO_MISSING",
      "Media không có audio stream",
    )
  const durationMs = Math.round(metadata.durationSeconds * 1000)
  const audioKey = await steps.run("EXTRACT_AUDIO", async () => {
    const key = `${prefix}/asr.wav`
    if (!(await exists(key))) {
      const local = path.join(temp, "asr.wav")
      await extractAudioForASR(source, local, signal)
      await validateAsrAudio(local, signal)
      await artifact("asr.wav", local, "audio/wav")
    }
    return key
  })
  if (
    !(await exists(audioKey)) &&
    !steps.checkpoint.primaryAsr &&
    !steps.steps.PRIMARY_TRANSCRIPTION?.output
  ) {
    // Cleanup may have expired a failed job's reproducible WAV. Restore only this
    // local artifact; submitted Azure jobs and completed ASR are never resubmitted.
    const local = path.join(temp, "asr.wav")
    await extractAudioForASR(source, local, signal)
    await validateAsrAudio(local, signal)
    await uploadR2File(audioKey, local, "audio/wav")
    await steps.write({ "artifacts.restoredAudio": audioKey })
  }
  let thumbnailKey =
    lesson.thumbnailKey ?? steps.checkpoint.thumbnailKey as string | undefined
  if (!thumbnailKey && metadata.width) {
    const key = `thumbnails/${lessonId}/${jobId}.jpg`
    try {
      if (!(await exists(key))) {
        const file = await generateThumbnail(
          source,
          temp,
          "thumbnail.jpg",
          "00:00:00",
          signal,
        )
        await uploadR2File(key, file, "image/jpeg")
      }
      await steps.save("thumbnailKey", key)
      thumbnailKey = key
    } catch (error) {
      signal.throwIfAborted()
      await warn(`THUMBNAIL_UNAVAILABLE: ${sanitizeProviderMessage(error)}`)
    }
  }
  const mediaType =
    lesson.mediaType && lesson.mediaType !== "AUTO"
      ? lesson.mediaType
      : lesson.contentMode === "song"
        ? "MUSIC"
        : lesson.contentMode === "podcast" || !metadata.width
          ? "PODCAST"
          : "MOVIE"
  await steps.write({
    mediaType,
    "processingMetrics.estimatedUsage": estimateProcessingUsage(
      metadata.durationSeconds,
      mediaType === "MUSIC",
    ),
  })

  const asr = async (
    which: "primary" | "secondary",
    key: string,
  ): Promise<SpeechSegment[]> => {
    const stateKey = `${which}Asr`
    const state = (steps.checkpoint[stateKey] ?? {}) as {
      submissionStarted?: boolean
      transcriptionUrl?: string
      rawKey?: string
    }
    if (state.rawKey && (await exists(state.rawKey))) {
      const local = path.join(temp, `${which}-raw.json`)
      await downloadR2Object(state.rawKey, local)
      const raw: unknown = JSON.parse(await fs.readFile(local, "utf8"))
      return (Array.isArray(raw) ? raw : [raw]).flatMap(
        parseBatchTranscriptionResult,
      )
    }
    const url =
      state.transcriptionUrl || state.submissionStarted
        ? ""
        : await createVideoDownloadUrl(key, env.R2_ASR_SIGNED_URL_TTL_SECONDS)
    const result = await azureSpeechBatchWhisperProvider.transcribeFromUrl(
      url,
      signal,
      {
        displayName: `hanflix-${lessonId}-v${job.pipelineVersion ?? 2}-${jobId}-${which}`,
        transcriptionUrl: state.transcriptionUrl,
        submissionStarted: state.submissionStarted,
        beforeSubmit: async () => {
          await steps.write(
            {
              [`checkpoint.${stateKey}`]: { ...state, submissionStarted: true },
            },
            {
              "processingMetrics.azureAsrRequests": 1,
              "processingMetrics.azureAsrAudioSeconds":
                metadata.durationSeconds,
            },
            { [`checkpoint.${stateKey}.submissionStarted`]: { $ne: true } },
          )
          state.submissionStarted = true
          steps.checkpoint[stateKey] = state
        },
        onSubmitted: async (transcriptionUrl) => {
          state.transcriptionUrl = transcriptionUrl
          await steps.save(stateKey, state)
          await steps.write({
            azureTranscriptionUrl: transcriptionUrl,
            azureTranscriptionId: new URL(transcriptionUrl).pathname
              .split("/")
              .at(-1),
          })
        },
        onRawResult: async (raw) => {
          const local = path.join(temp, `${which}-raw.json`)
          await fs.writeFile(local, JSON.stringify(raw))
          state.rawKey = await artifact(
            `${which}-raw.json`,
            local,
            "application/json",
          )
          await steps.save(stateKey, state)
        },
      },
    )
    return result.segments
  }
  const separate = () =>
    steps.run("SEPARATE_VOCALS", async () => {
      const key = `${prefix}/vocals-asr.wav`
      if (await exists(key)) return key
      const input = path.join(temp, "source-44100.wav")
      const vocals = path.join(temp, "vocals.wav")
      const output = path.join(temp, "vocals-asr.wav")
      // Claim once. An abandoned local run cannot silently consume another Demucs run.
      const started = steps.checkpoint.demucsStarted === true
      const inputKey = `${prefix}/source-44100.wav`
      const rawVocalsKey = `${prefix}/vocals.wav`
      const hasVocals = await exists(rawVocalsKey)
      if (started && env.MEDIA_COMPUTE_PROVIDER === "local" && !hasVocals)
        throw new AppError(
          409,
          "DEMUCS_RUN_UNCERTAIN",
          "Demucs đã chạy nhưng output chưa được lưu",
        )
      await steps.write({ "artifacts.vocals_wav": rawVocalsKey })
      if (!started && !hasVocals) {
        await extractAudioForSeparation(source, input, signal)
        await artifact("source-44100.wav", input, "audio/wav")
      }
      if (!started) {
        await steps.write(
          { "checkpoint.demucsStarted": true },
          { "processingMetrics.demucsRuns": 1 },
          { "checkpoint.demucsStarted": { $ne: true } },
        )
        steps.checkpoint.demucsStarted = true
      }
      const start = Date.now()
      if (hasVocals) await downloadR2Object(rawVocalsKey, vocals, signal)
      else
        await mediaComputeProvider.separateVocals(input, vocals, signal, {
          inputKey,
          outputKey: rawVocalsKey,
          execution: steps.checkpoint.mediaExecution as string | undefined,
          started: steps.checkpoint.mediaExecutionStarted === true,
          beforeStart: () => steps.save("mediaExecutionStarted", true),
          onStarted: (execution) => steps.save("mediaExecution", execution),
        })
      if (env.MEDIA_COMPUTE_PROVIDER === "local" && !hasVocals)
        await artifact("vocals.wav", vocals, "audio/wav")
      await steps.write({}, {
        "processingMetrics.demucsProcessingSeconds":
          (Date.now() - start) / 1000,
      })
      await extractAudioForASR(vocals, output, signal)
      await validateAsrAudio(output, signal)
      return artifact("vocals-asr.wav", output, "audio/wav")
    })
  let primaryKey = audioKey
  if (mediaType === "MUSIC" && env.MUSIC_PRESEPARATE_VOCALS) {
    try {
      primaryKey = await separate()
    } catch (error) {
      signal.throwIfAborted()
      await warn(`DEMUCS_UNAVAILABLE: ${sanitizeProviderMessage(error)}`)
    }
  }
  let lyricSegments: SpeechSegment[] | undefined
  if (lesson.contentMode === "song" && lesson.lyricsRaw?.trim()) {
    const { parseLyricsSmart } = await import(
      "../song/lyrics-parser.service.js"
    )
    const lyrics = parseLyricsSmart(lesson.lyricsRaw)
    if (!lyrics.hasTimestamps)
      throw new AppError(
        422,
        "LYRICS_TIMESTAMPS_REQUIRED",
        "Lời bài hát cần LRC có timestamp",
      )
    lyricSegments = lyrics.cues
      .map((c) => ({
        text: c.text,
        startMs: c.startMs,
        endMs: Math.min(c.endMs, durationMs),
      }))
      .filter((c) => c.endMs > c.startMs)
  }
  let segments = await steps.run("PRIMARY_TRANSCRIPTION", async () => {
    try {
      return await asr("primary", primaryKey)
    } catch (error) {
      signal.throwIfAborted()
      if (
        !lyricSegments?.length ||
        (error instanceof AppError && error.code === "LEASE_REVOKED")
      )
        throw error
      await warn("ASR_UNAVAILABLE: retaining supplied LRC; timing approximate")
      return lyricSegments
    }
  })
  const quality = await steps.run("EVALUATE_TRANSCRIPTION", async () =>
    evaluateTranscription({
      segments,
      audioDurationMs: durationMs,
      goodThreshold: env.ASR_GOOD_THRESHOLD,
      retryThreshold: env.ASR_RETRY_THRESHOLD,
    }),
  )
  let finalQuality = quality
  if (
    mediaType === "MUSIC" &&
    quality.status === "BAD" &&
    !env.MUSIC_PRESEPARATE_VOCALS
  ) {
    try {
      const vocalsKey = await separate()
      const secondary = await steps.run("SECONDARY_TRANSCRIPTION", () =>
        asr("secondary", vocalsKey),
      )
      const secondaryQuality = evaluateTranscription({
        segments: secondary,
        audioDurationMs: durationMs,
        goodThreshold: env.ASR_GOOD_THRESHOLD,
        retryThreshold: env.ASR_RETRY_THRESHOLD,
      })
      if (secondaryQuality.score > quality.score) {
        segments = secondary
        finalQuality = secondaryQuality
      }
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof AppError && error.code === "LEASE_REVOKED")
        throw error
      await warn(`SECONDARY_UNAVAILABLE: ${sanitizeProviderMessage(error)}`)
    }
  } else {
    await steps.skip("SEPARATE_VOCALS", "Not required by media policy")
    await steps.skip("SECONDARY_TRANSCRIPTION", "Not required by media policy")
  }
  if (finalQuality.status !== "GOOD")
    await warn("NEEDS_REVIEW: transcription quality")
  await steps.write({ "processingMetrics.transcriptionQuality": finalQuality })
  if (lyricSegments?.length) segments = lyricSegments
  const normalized = await steps.run("NORMALIZE_TRANSCRIPT", async () =>
    segments.map((s) => ({
      ...s,
      rawText: s.text,
      text: s.text.normalize("NFKC").trim(),
    })),
  )
  await steps.run("VALIDATE_TIMESTAMPS", async () => {
    if (
      normalized.some(
        (s) =>
          !Number.isFinite(s.startMs) ||
          !Number.isFinite(s.endMs) ||
          s.endMs <= s.startMs,
      )
    )
      throw new AppError(
        422,
        "INVALID_CUE_TIME",
        "Azure timestamps không hợp lệ",
      )
    return { durationMs }
  })
  // Fine aligner is optional: Azure units remain intact and interpolation is explicitly marked.
  await steps.skip(
    "ALIGN_TIMESTAMPS",
    env.ALIGNMENT_ENABLED && env.ALIGNMENT_MODE !== "DISABLED"
      ? "Fine aligner unavailable; review required"
      : "Disabled by configuration",
  )
  const prepared = await steps.run("SEGMENT_SUBTITLES", async () => {
    const result = prepareCues(
      normalized.map((s) => ({ ...s, text: s.rawText })),
      durationMs,
      env.ALIGNMENT_ALLOW_APPROXIMATE && env.ALIGNMENT_MODE !== "REQUIRED",
    )
    if (lesson.contentMode === "podcast") {
      const { detectChapters } = await import(
        "../podcast/chapter-detector.service.js"
      )
      const chapters =
        steps.checkpoint.chapters ??
        (await detectChapters({ segments: normalized, durationMs }, signal))
      await steps.save("chapters", chapters)
    }
    if (lesson.contentMode === "drama")
      await warn(
        "SPEAKER_LABELS_REQUIRE_REVIEW: Whisper pipeline does not invent speaker identities",
      )
    return result
  })
  if (prepared.some((c) => c.needsFineAlignment))
    await warn("APPROXIMATE_TIMING: fine alignment unavailable")
  const pinyinCues = await steps.run("GENERATE_PINYIN", async () =>
    enrichPreparedCues(prepared),
  )
  const translated = await steps.run("TRANSLATE", async () => {
    const translations = [
      ...(steps.checkpoint.translations as string[] | undefined ?? []),
    ]
    if (steps.checkpoint.translationPending != null)
      throw new AppError(
        409,
        "TRANSLATION_SUBMISSION_UNCERTAIN",
        "Batch dịch chưa xác định; không gửi lại để tránh tính phí trùng",
      )
    while (translations.length < pinyinCues.length) {
      const offset = translations.length
      const batch = pinyinCues.slice(offset, offset + 100)
      const missing = batch.filter((c) => !migrated.translationMemory[c.zh])
      if (missing.length) await steps.save("translationPending", offset)
      let result: string[]
      try {
        result = missing.length
          ? await translationService.translateChineseToVietnamese(
              missing.map((c) => c.zh),
              signal,
            )
          : []
      } catch (error) {
        if (
          error instanceof AppError &&
          [
            "FAILED_TRANSLATION",
            "AZURE_TRANSLATOR_NOT_CONFIGURED",
            "INVALID_TRANSLATION_INPUT",
          ].includes(error.code)
        )
          await steps.save("translationPending", null)
        throw error
      }
      let next = 0
      translations.push(
        ...batch.map(
          (c) => migrated.translationMemory[c.zh] ?? result[next++]!,
        ),
      )
      await steps.write(
        {
          "checkpoint.translations": translations,
          "checkpoint.translationPending": null,
        },
        {
          "processingMetrics.translatorCharacters": missing.reduce(
            (n, c) => n + c.zh.length,
            0,
          ),
        },
      )
      steps.checkpoint.translations = translations
    }
    return pinyinCues.map((cue, i) => ({
      ...cue,
      vi: translations[i]!,
      tokens: cue.karaokeTokens.map((t) => ({
        text: t.text,
        wordId: null as Types.ObjectId | null,
      })),
    }))
  })
  const enriched = await steps.run("EXTRACT_VOCABULARY", async () => {
    try {
      const ids = await resolveLearningWordIds(translated)
      for (const cue of translated)
        for (const token of cue.tokens)
          token.wordId = ids.get(token.text) ?? null
    } catch (error) {
      signal.throwIfAborted()
      await warn(`VOCABULARY_UNAVAILABLE: ${sanitizeProviderMessage(error)}`)
    }
    return translated
  })
  const chapters = steps.checkpoint.chapters as Array<{
    chapterId: string
    title: string
    startMs: number
    endMs: number
    summary?: string
  }> | undefined
  const cues = await steps.run("BUILD_SUBTITLES", async () => {
    if (
      env.PLAYBACK_DERIVATIVE_ENABLED &&
      metadata.width &&
      !steps.checkpoint.playbackAttempted
    ) {
      const outputKey = `lessons/${lessonId}/playback/${jobId}.mp4`
      const playback =
        lesson.playbackKey &&
        lesson.playbackVersion === PLAYBACK_DERIVATIVE_VERSION
          ? {
              playbackKey: lesson.playbackKey,
              playbackVersion: lesson.playbackVersion,
            }
          : (await exists(outputKey))
            ? {
                playbackKey: outputKey,
                playbackVersion: PLAYBACK_DERIVATIVE_VERSION,
              }
            : await generatePlaybackDerivative({
                lessonId,
                sourcePath: source,
                signal,
                outputKey,
              })
      if (playback)
        await steps.save("playback", {
          playbackKey: playback.playbackKey,
          playbackVersion: playback.playbackVersion,
        })
      await steps.save("playbackAttempted", true)
    }
    return enriched.map((c) => ({
      ...c,
      quality: finalQuality.status,
      ...(chapters
        ? {
            chapterId: chapters.find(
              (ch) => c.startMs >= ch.startMs && c.startMs < ch.endMs,
            )?.chapterId,
          }
        : {}),
    })) as SubtitleCueInput[]
  })
  const summary = await steps.run("VALIDATE_RESULT", async () =>
    validateFinalCues(cues, durationMs),
  )
  await steps.write({
    "processingMetrics.qualitySummary": { ...summary, warnings },
    "processingMetrics.alignmentRuns": 0,
    "processingMetrics.alignmentProcessingSeconds": 0,
  })
  await steps.run("CLEANUP", async () => {
    for (const name of [
      "asr.wav",
      "vocals.wav",
      "vocals-asr.wav",
      "source-44100.wav",
      "primary-raw.json",
      "secondary-raw.json",
    ])
      await fs.rm(path.join(temp, name), { force: true })
    return { artifactsExpireAfterHours: env.PROCESSING_ARTIFACT_TTL_HOURS }
  })
  signal.throwIfAborted()
  await steps.write({
    currentStep: "READY_FOR_REVIEW",
    "steps.READY_FOR_REVIEW": {
      status: "RUNNING",
      attempt: (steps.steps.READY_FOR_REVIEW?.attempt ?? 0) + 1,
      startedAt: new Date(),
    },
  })
  const playback = steps.checkpoint.playback as {
    playbackKey: string
    playbackVersion: number
  } | undefined
  await runGenerationCommit({
    lessonId,
    jobId,
    leaseToken: lease.leaseToken,
    durationSeconds: metadata.durationSeconds,
    thumbnailKey,
    cues,
    chapters,
    ...playback,
    questions:
      (lesson.contentMode ?? "lesson") === "lesson"
        ? cues
            .slice(0, resolveQuestionCount(lesson.hsk, lesson.autoGenerateQuizCount))
            .map((cue, i) => ({
              questionId: `q-${i + 1}`,
              type: "fill_blank",
              prompt: `Nhập lại câu tiếng Trung: ${cue.vi}`,
              cueId: cue.cueId,
              options: [],
              acceptedAnswers: [cue.zh],
              explanationVi: cue.zh,
            }))
        : [],
  })
}
