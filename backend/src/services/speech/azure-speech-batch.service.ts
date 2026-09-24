import { setTimeout as delay } from "node:timers/promises"
import { env } from "../../config/env.js"
import { AppError } from "../../errors/app-error.js"
import type { SpeechSegment } from "./speech-to-text.service.js"

type Json = Record<string, unknown>
const record = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Json
    : {}
export function sanitizeProviderMessage(value: unknown): string {
  return String(value instanceof Error ? value.message : value)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL REDACTED]")
    .replace(
      /(subscription-key|api[-_]?key|authorization|secret|token)\s*[:=]\s*\S+/gi,
      "$1=[REDACTED]",
    )
    .slice(0, 800)
}
function endpoint(): string {
  if (!env.AZURE_SPEECH_ENDPOINT)
    throw new AppError(
      503,
      "AZURE_ASR_NOT_CONFIGURED",
      "Azure Speech endpoint chưa được cấu hình",
    )
  return env.AZURE_SPEECH_ENDPOINT.replace(/\/$/, "")
}
function api(resource: string, query?: Record<string, string>): string {
  const sep = resource.includes("?") ? "&" : "?"
  let url = `${endpoint()}/speechtotext/${resource}${sep}api-version=${encodeURIComponent(env.AZURE_SPEECH_BATCH_API_VERSION)}`
  if (query) {
    for (const [key, val] of Object.entries(query)) {
      url += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`
    }
  }
  return url
}
function milliseconds(item: Json, key: "offset" | "duration"): number {
  const ms = item[`${key}Milliseconds`]
  if (typeof ms === "number") return ms
  const ticks = item[`${key}InTicks`] ?? item[`${key}Ticks`]
  if (typeof ticks === "number") return ticks / 10_000
  const value = item[key]
  if (typeof value === "number") return value / 10_000 // Batch legacy numeric values are ticks.
  if (typeof value === "string") {
    const match =
      /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(
        value,
      )
    if (match)
      return (
        (Number(match[1] ?? 0) * 3600 +
          Number(match[2] ?? 0) * 60 +
          Number(match[3] ?? 0)) *
        1000
      )
  }
  return NaN
}
export function parseBatchTranscriptionResult(body: unknown): SpeechSegment[] {
  const data = record(body)
  const phrases = data.recognizedPhrases ?? data.phrases
  if (!Array.isArray(phrases))
    throw new AppError(
      502,
      "AZURE_ASR_INVALID_RESPONSE",
      "Azure result thiếu recognizedPhrases",
    )
  const segments: SpeechSegment[] = []
  for (const entry of phrases) {
    const phrase = record(entry)
    if (phrase.recognitionStatus && phrase.recognitionStatus !== "Success")
      continue
    const best = record(
      Array.isArray(phrase.nBest) ? phrase.nBest[0] : undefined,
    )
    const text = String(
      phrase.text ?? phrase.display ?? best.display ?? best.lexical ?? "",
    ).trim()
    const startMs = Math.round(milliseconds(phrase, "offset"))
    const endMs = startMs + Math.round(milliseconds(phrase, "duration"))
    if (
      !text ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      startMs < 0 ||
      endMs <= startMs
    )
      continue
    const rawWords = best.displayWords ?? best.words ?? phrase.words
    const words = Array.isArray(rawWords)
      ? rawWords.flatMap((entry) => {
          const word = record(entry)
          const text = String(
            word.displayText ?? word.word ?? word.text ?? "",
          ).trim()
          const startMs = Math.round(milliseconds(word, "offset"))
          const endMs = startMs + Math.round(milliseconds(word, "duration"))
          return text &&
            Number.isFinite(startMs) &&
            Number.isFinite(endMs) &&
            startMs >= 0 &&
            endMs > startMs
            ? [{ text, startMs, endMs }]
            : []
        })
      : []
    segments.push({
      text,
      startMs,
      endMs,
      words: words.length ? words : undefined,
    })
  }
  if (!segments.length)
    throw new AppError(
      502,
      "AZURE_ASR_EMPTY_TRANSCRIPT",
      "Azure không nhận dạng được câu thoại hợp lệ",
    )
  return segments.sort((a, b) => a.startMs - b.startMs)
}
export interface BatchResume {
  displayName: string
  transcriptionUrl?: string
  submissionStarted?: boolean
  beforeSubmit: () => Promise<void>
  onSubmitted: (url: string) => Promise<void>
  onRawResult: (body: unknown) => Promise<void>
}
export interface BatchTranscriptionResult {
  segments: SpeechSegment[]
  transcriptionUrl: string
  modelSelf?: string
}
export class AzureSpeechBatchWhisperProvider {
  private modelSelf?: string
  private modelExpiresAt = 0
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep = (ms: number, signal?: AbortSignal) =>
      delay(ms, undefined, { signal }),
  ) {}

  private trusted(url: string): string {
    const target = new URL(url)
    if (
      target.protocol !== "https:" ||
      target.origin !== new URL(endpoint()).origin
    )
      throw new AppError(
        502,
        "AZURE_ASR_INVALID_URL",
        "Azure trả về URL ngoài endpoint đã cấu hình",
      )
    return target.toString()
  }
  private async request(
    url: string,
    signal?: AbortSignal,
    body?: unknown,
    authenticated = true,
  ): Promise<{ body: Json; response: Response }> {
    if (authenticated) this.trusted(url)
    else if (new URL(url).protocol !== "https:")
      throw new AppError(
        502,
        "AZURE_ASR_INVALID_URL",
        "Result URL phải dùng HTTPS",
      )
    const attempts = body === undefined ? env.AZURE_PROVIDER_MAX_RETRIES : 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      signal?.throwIfAborted()
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: body === undefined ? "GET" : "POST",
          redirect: "error",
          headers: {
            ...(authenticated
              ? { "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY ?? "" }
              : {}),
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
            : AbortSignal.timeout(60_000),
        })
      } catch {
        signal?.throwIfAborted()
        if (attempt + 1 < attempts) {
          await this.sleep(1000 * 2 ** attempt, signal)
          continue
        }
        throw new AppError(
          502,
          body === undefined
            ? "AZURE_ASR_NETWORK_ERROR"
            : "AZURE_ASR_SUBMISSION_UNCERTAIN",
          "Azure Speech mất kết nối hoặc hết thời gian chờ; không tự submit lại",
        )
      }
      const payload = record(await response.json().catch(() => undefined))
      if (response.ok) return { body: payload, response }
      const transient =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500
      if (transient && attempt + 1 < attempts) {
        const retryAfter =
          Number(response.headers.get("retry-after")) || 2 ** attempt
        await this.sleep(Math.min(30_000, retryAfter * 1000), signal)
        continue
      }
      const code =
        response.status === 401 || response.status === 403
          ? "AZURE_ASR_AUTH_ERROR"
          : response.status === 404
            ? "AZURE_ASR_RESOURCE_NOT_FOUND"
            : response.status === 429
              ? "AZURE_ASR_RATE_LIMITED"
              : response.status === 408
                ? "AZURE_ASR_TIMEOUT"
                : response.status >= 500
                  ? "AZURE_ASR_SERVER_ERROR"
                  : "AZURE_ASR_REQUEST_REJECTED"
      const detailMsg =
        typeof payload.message === "string"
          ? payload.message
          : typeof record(payload.innerError).message === "string"
            ? String(record(payload.innerError).message)
            : ""
      const detailSuffix = detailMsg ? `: ${detailMsg}` : ""
      throw new AppError(502, code, `Azure Speech HTTP ${response.status}${detailSuffix}`)
    }
    throw new AppError(
      502,
      "AZURE_ASR_NETWORK_ERROR",
      "Azure read retry budget exhausted",
    )
  }
  private async list(url: string, signal?: AbortSignal): Promise<Json[]> {
    const values: Json[] = []
    const seen = new Set<string>()
    while (url && seen.size < 100) {
      if (seen.has(url))
        throw new AppError(
          502,
          "AZURE_ASR_INVALID_RESPONSE",
          "Azure pagination loop",
        )
      seen.add(url)
      const { body } = await this.request(url, signal)
      if (!Array.isArray(body.values))
        throw new AppError(
          502,
          "AZURE_ASR_INVALID_RESPONSE",
          "Azure list thiếu values",
        )
      values.push(...body.values.map(record))
      url = typeof body["@nextLink"] === "string" ? body["@nextLink"] : ""
      if (url) {
        await this.sleep(100, signal)
      }
    }
    if (url)
      throw new AppError(
        502,
        "AZURE_ASR_PAGINATION_LIMIT",
        "Azure list vượt giới hạn an toàn",
      )
    return values
  }
  async getModelSelf(signal?: AbortSignal): Promise<string> {
    if (env.AZURE_SPEECH_WHISPER_MODEL_SELF)
      return this.trusted(env.AZURE_SPEECH_WHISPER_MODEL_SELF)
    if (this.modelSelf && Date.now() < this.modelExpiresAt)
      return this.modelSelf
    const models = await this.list(
      api("models/base", {
        filter: `locale eq '${env.AZURE_SPEECH_LOCALE}'`,
      }),
      signal,
    )
    const candidates = models
      .filter((model) => {
        const props = record(model.properties)
        const deprecation = record(props.deprecationDates)
        const expiry =
          deprecation.transcriptionDateTime ?? props.expirationDateTime
        const expired =
          typeof expiry === "string" &&
          (!Number.isFinite(Date.parse(expiry)) ||
            Date.parse(expiry) <= Date.now())
        const features = record(props.features)
        const supports =
          (features.supportsTranscriptionsSubmit ??
            features.supportsTranscriptions ??
            props.supportsTranscriptionsSubmit ??
            props.supportsTranscriptions) === true
        const isWhisper = /whisper/i.test(String(model.displayName))
        const matchesLocale =
          !model.locale ||
          model.locale === env.AZURE_SPEECH_LOCALE ||
          (isWhisper && model.locale === "en-US")
        return (
          matchesLocale &&
          isWhisper &&
          supports &&
          (!model.status || model.status === "Succeeded") &&
          !expired
        )
      })
      .sort((a, b) => {
        const aLocaleMatch = a.locale === env.AZURE_SPEECH_LOCALE ? 1 : 0
        const bLocaleMatch = b.locale === env.AZURE_SPEECH_LOCALE ? 1 : 0
        if (bLocaleMatch !== aLocaleMatch) return bLocaleMatch - aLocaleMatch
        return String(b.createdDateTime ?? b.displayName).localeCompare(
          String(a.createdDateTime ?? a.displayName),
        )
      })
    if (!candidates[0] || typeof candidates[0].self !== "string")
      throw new AppError(
        503,
        "AZURE_ASR_MODEL_NOT_FOUND",
        "Không tìm thấy Whisper zh-CN còn hiệu lực và hỗ trợ batch transcription",
      )
    this.modelSelf = this.trusted(candidates[0].self)
    this.modelExpiresAt =
      Date.now() + env.AZURE_SPEECH_MODEL_CACHE_HOURS * 3_600_000
    return this.modelSelf
  }
  async transcribeFromUrl(
    audioUrl: string,
    signal?: AbortSignal,
    resume?: BatchResume,
  ): Promise<BatchTranscriptionResult> {
    if (!env.AZURE_SPEECH_KEY)
      throw new AppError(
        503,
        "AZURE_ASR_NOT_CONFIGURED",
        "Azure Speech key chưa được cấu hình",
      )
    if (!resume)
      throw new AppError(
        500,
        "AZURE_ASR_DURABLE_STATE_REQUIRED",
        "Batch ASR cần durable submission checkpoint",
      )
    let transcriptionUrl = resume.transcriptionUrl
    let modelSelf: string | undefined
    if (!transcriptionUrl && resume.submissionStarted) {
      const matches = (await this.list(api("transcriptions"), signal)).filter(
        (item) => item.displayName === resume.displayName,
      )
      if (matches.length !== 1 || typeof matches[0]?.self !== "string")
        throw new AppError(
          409,
          "AZURE_ASR_SUBMISSION_UNCERTAIN",
          "Submission chưa xác định; giữ nguyên intent và kiểm tra Azure trước khi retry. Không submit thêm.",
        )
      transcriptionUrl = this.trusted(matches[0].self)
      await resume.onSubmitted(transcriptionUrl)
    }
    if (!transcriptionUrl) {
      modelSelf = await this.getModelSelf(signal)
      await resume.beforeSubmit() // durable intent BEFORE irreversible POST
      const { body, response } = await this.request(
        api("transcriptions:submit"),
        signal,
        {
          displayName: resume.displayName,
          locale: "zh-CN",
          contentUrls: [audioUrl],
          model: { self: modelSelf },
          properties: {
            displayFormWordLevelTimestampsEnabled: true,
            timeToLiveHours: Math.max(6, env.PROCESSING_ARTIFACT_TTL_HOURS),
          },
        },
      )
      transcriptionUrl =
        typeof body.self === "string"
          ? body.self
          : (response.headers.get("location") ?? undefined)
      if (!transcriptionUrl)
        throw new AppError(
          502,
          "AZURE_ASR_SUBMISSION_UNCERTAIN",
          "Azure đã nhận request nhưng thiếu transcription URL",
        )
      this.trusted(transcriptionUrl)
      await resume.onSubmitted(transcriptionUrl) // persist before first poll
    }
    const deadline = Date.now() + env.VIDEO_STAGE_DEADLINE_TRANSCRIBE_MS
    let interval = 2000
    while (Date.now() < deadline) {
      const { body } = await this.request(transcriptionUrl, signal)
      if (body.status === "Succeeded") {
        const filesUrl = record(body.links).files
        if (typeof filesUrl !== "string")
          throw new AppError(
            502,
            "AZURE_ASR_INVALID_RESPONSE",
            "Azure thiếu files URL",
          )
        const files = await this.list(filesUrl, signal)
        const filesToRead = files.filter(
          (file) => file.kind === "Transcription",
        )
        if (!filesToRead.length)
          throw new AppError(
            502,
            "AZURE_ASR_EMPTY_TRANSCRIPT",
            "Azure không có file transcription",
          )
        const raw: Json[] = []
        for (const file of filesToRead) {
          const contentUrl = record(file.links).contentUrl
          if (typeof contentUrl !== "string")
            throw new AppError(
              502,
              "AZURE_ASR_INVALID_RESPONSE",
              "Azure thiếu contentUrl",
            )
          raw.push(
            (await this.request(contentUrl, signal, undefined, false)).body,
          )
        }
        await resume.onRawResult(raw)
        return {
          segments: raw
            .flatMap(parseBatchTranscriptionResult)
            .sort((a, b) => a.startMs - b.startMs),
          transcriptionUrl,
          modelSelf,
        }
      }
      if (body.status === "Failed") {
        const error = record(record(body.properties).error)
        const unreachable = /download|uri|url|access|audio/i.test(
          String(error.code),
        )
        throw new AppError(
          502,
          unreachable
            ? "AZURE_ASR_AUDIO_UNREACHABLE"
            : "AZURE_ASR_TRANSCRIPTION_FAILED",
          `Azure transcription failed: ${sanitizeProviderMessage(error.code ?? "unknown")}`,
        )
      }
      if (!["NotStarted", "Running"].includes(String(body.status)))
        throw new AppError(
          502,
          "AZURE_ASR_INVALID_RESPONSE",
          "Azure trả về trạng thái không hợp lệ",
        )
      await this.sleep(interval, signal)
      interval = Math.min(30_000, interval * 2)
    }
    throw new AppError(
      504,
      "AZURE_ASR_TIMEOUT",
      "Azure Batch quá thời gian; retry sẽ poll transcription hiện có",
    )
  }
}
export const azureSpeechBatchWhisperProvider =
  new AzureSpeechBatchWhisperProvider()
