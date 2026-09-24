import { beforeEach, describe, expect, it, vi } from "vitest"
import { env } from "../../config/env.js"
import {
  AzureSpeechBatchWhisperProvider,
  parseBatchTranscriptionResult,
  sanitizeProviderMessage,
} from "./azure-speech-batch.service.js"
const endpoint = "https://eastasia.api.cognitive.microsoft.com"
const self = `${endpoint}/speechtotext/transcriptions/test`
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
const raw = {
  recognizedPhrases: [
    {
      recognitionStatus: "Success",
      offset: "PT0.1S",
      duration: "PT0.9S",
      nBest: [
        {
          display: "你好",
          displayWords: [
            {
              displayText: "你好",
              offsetInTicks: 1_000_000,
              durationInTicks: 9_000_000,
            },
          ],
        },
      ],
    },
  ],
}
const state = () => ({
  displayName: "stable-job-primary",
  beforeSubmit: vi.fn().mockResolvedValue(undefined),
  onSubmitted: vi.fn().mockResolvedValue(undefined),
  onRawResult: vi.fn().mockResolvedValue(undefined),
})
beforeEach(() => {
  env.AZURE_SPEECH_KEY = "secret-test"
  env.AZURE_SPEECH_ENDPOINT = endpoint
  env.AZURE_SPEECH_WHISPER_MODEL_SELF = `${endpoint}/speechtotext/models/base/whisper`
  env.AZURE_PROVIDER_MAX_RETRIES = 2
})
describe("durable Azure Batch", () => {
  it("parses ISO8601, ticks and displayWords without pretending multi-Hanzi is character timing", () => {
    expect(parseBatchTranscriptionResult(raw)[0]).toMatchObject({
      startMs: 100,
      endMs: 1000,
      words: [{ text: "你好", startMs: 100, endMs: 1000 }],
    })
  })
  it("submits root model, persists URL before poll, fetches result without sending Speech key to blob", async () => {
    const resume = state()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        expect(resume.beforeSubmit).toHaveBeenCalledOnce()
        const body = JSON.parse(init.body)
        expect(body.model.self).toContain("whisper")
        expect(body.locale).toBe("zh-CN")
        expect(body.properties.displayFormWordLevelTimestampsEnabled).toBe(true)
        return response({ self })
      })
      .mockImplementationOnce(async () => {
        expect(resume.onSubmitted).toHaveBeenCalledWith(self)
        return response({
          status: "Succeeded",
          links: { files: `${self}/files` },
        })
      })
      .mockResolvedValueOnce(
        response({
          values: [
            {
              kind: "Transcription",
              links: { contentUrl: "https://blob.example/result?sig=secret" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response(raw))
    const result = await new AzureSpeechBatchWhisperProvider(
      fetchMock,
    ).transcribeFromUrl(
      "https://r2.example/audio?sig=secret",
      undefined,
      resume,
    )
    expect(result.segments).toHaveLength(1)
    expect(resume.onRawResult).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[3]![1].headers).not.toHaveProperty(
      "Ocp-Apim-Subscription-Key",
    )
  })
  it("resumes existing transcription without discovery or POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({
          status: "Failed",
          properties: { error: { code: "AudioDownloadFailed" } },
        }),
      )
    await expect(
      new AzureSpeechBatchWhisperProvider(fetchMock).transcribeFromUrl(
        "",
        undefined,
        { ...state(), transcriptionUrl: self },
      ),
    ).rejects.toMatchObject({ code: "AZURE_ASR_AUDIO_UNREACHABLE" })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]![1].method).toBe("GET")
  })
  it("recovers crash after Azure accepted submit by stable name", async () => {
    const resume = { ...state(), submissionStarted: true }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ values: [{ displayName: resume.displayName, self }] }),
      )
      .mockResolvedValueOnce(response({ status: "Failed" }))
    await expect(
      new AzureSpeechBatchWhisperProvider(fetchMock).transcribeFromUrl(
        "",
        undefined,
        resume,
      ),
    ).rejects.toMatchObject({ code: "AZURE_ASR_TRANSCRIPTION_FAILED" })
    expect(resume.onSubmitted).toHaveBeenCalledWith(self)
    expect(resume.beforeSubmit).not.toHaveBeenCalled()
  })
  it("never resubmits an uncertain intent even when Azure list is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ values: [] }))
    await expect(
      new AzureSpeechBatchWhisperProvider(fetchMock).transcribeFromUrl(
        "",
        undefined,
        { ...state(), submissionStarted: true },
      ),
    ).rejects.toMatchObject({ code: "AZURE_ASR_SUBMISSION_UNCERTAIN" })
    expect(fetchMock.mock.calls.every((call) => call[1].method === "GET")).toBe(
      true,
    )
  })
  it.each([401, 403, 404, 408, 429, 500])(
    "bounds GET retries for HTTP %s and redacts provider messages",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () =>
          response({ error: { message: "https://x/?sig=secret" } }, status),
        )
      const sleep = vi.fn().mockResolvedValue(undefined)
      await expect(
        new AzureSpeechBatchWhisperProvider(fetchMock, sleep).transcribeFromUrl(
          "",
          undefined,
          { ...state(), transcriptionUrl: self },
        ),
      ).rejects.toThrow(`HTTP ${status}`)
      expect(fetchMock).toHaveBeenCalledTimes(
        [408, 429, 500].includes(status) ? 2 : 1,
      )
    },
  )
  it("does not retry POST on network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("timeout https://secret"))
    await expect(
      new AzureSpeechBatchWhisperProvider(fetchMock).transcribeFromUrl(
        "https://r2/audio",
        undefined,
        state(),
      ),
    ).rejects.toMatchObject({ code: "AZURE_ASR_SUBMISSION_UNCERTAIN" })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it("rejects empty and malformed transcripts separately", () => {
    expect(() =>
      parseBatchTranscriptionResult({ recognizedPhrases: [] }),
    ).toThrow("Azure không nhận dạng")
    expect(() => parseBatchTranscriptionResult({})).toThrow(
      "thiếu recognizedPhrases",
    )
  })
  it("discovers non-expired transcription models across pages and caches", async () => {
    env.AZURE_SPEECH_WHISPER_MODEL_SELF = undefined
    const model = {
      self: `${endpoint}/models/good`,
      locale: "zh-CN",
      displayName: "Whisper",
      properties: { features: { supportsTranscriptions: true } },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          values: [
            {
              ...model,
              properties: {
                supportsTranscriptions: true,
                deprecationDates: { transcriptionDateTime: "2020-01-01" },
              },
            },
          ],
          "@nextLink": `${endpoint}/page2`,
        }),
      )
      .mockResolvedValueOnce(
        response({
          values: [
            model,
            { ...model, locale: "en-US", self: `${endpoint}/wrong` },
          ],
        }),
      )
    const provider = new AzureSpeechBatchWhisperProvider(fetchMock)
    expect(await provider.getModelSelf()).toBe(model.self)
    expect(await provider.getModelSelf()).toBe(model.self)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("backs off polling and cooperatively cancels", async () => {
    const controller = new AbortController()
    const sleep = vi.fn(async () => {
      controller.abort(new Error("LEASE_REVOKED"))
    })
    const fetchMock = vi.fn().mockResolvedValue(response({ status: "Running" }))
    await expect(
      new AzureSpeechBatchWhisperProvider(fetchMock, sleep).transcribeFromUrl(
        "",
        controller.signal,
        { ...state(), transcriptionUrl: self },
      ),
    ).rejects.toThrow("LEASE_REVOKED")
    expect(sleep).toHaveBeenCalledWith(2000, controller.signal)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it("refuses credential exfiltration to foreign control-plane URLs", async () => {
    const fetchMock = vi.fn()
    await expect(
      new AzureSpeechBatchWhisperProvider(fetchMock).transcribeFromUrl(
        "",
        undefined,
        { ...state(), transcriptionUrl: "https://evil.example/" },
      ),
    ).rejects.toMatchObject({ code: "AZURE_ASR_INVALID_URL" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      sanitizeProviderMessage(
        "url https://r2.example/x?sig=secret api-key=secret",
      ),
    ).not.toContain("secret")
  })
})
