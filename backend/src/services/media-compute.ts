import { spawn } from "node:child_process"

import { setTimeout as delay } from "node:timers/promises"

import { env } from "../config/env.js"

import { AppError } from "../errors/app-error.js"

import { confirmR2Object, downloadR2Object } from "./r2.js"

interface AzureJobResponse {
  name?: string
  location?: string
  properties?: {
    status?: string
    template?: {
      containers?: Array<{
        args?: string[]
        env?: Array<{ name: string; value?: string; secretRef?: string }>
      }>
    }
  }
}
export interface MediaJobContext {
  inputKey: string
  outputKey: string
  execution?: string
  started?: boolean

  beforeStart: () => Promise<void>
  onStarted: (execution: string) => Promise<void>
}

export interface MediaComputeProvider {
  separateVocals(
    inputPath: string,
    outputPath: string,
    signal?: AbortSignal,
    context?: MediaJobContext,
  ): Promise<void>
}

export class LocalMediaComputeProvider implements MediaComputeProvider {
  constructor(
    private readonly pythonCommand = process.env.HANFLIX_MEDIA_PYTHON ??
      "python",
  ) {}

  async separateVocals(
    inputPath: string,
    outputPath: string,
    signal?: AbortSignal,
  ): Promise<void> {
    signal?.throwIfAborted()
    const timeout = AbortSignal.timeout(env.MEDIA_JOB_TIMEOUT_SECONDS * 1000)
    signal = signal ? AbortSignal.any([signal, timeout]) : timeout

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        this.pythonCommand,
        [
          "-m",
          "src.main",
          "separate-vocals",
          "--input",
          inputPath,
          "--output",
          outputPath,
        ],

        {
          cwd: new URL("../../workers/media-ai/", import.meta.url),
          windowsHide: true,
          detached: process.platform !== "win32",
          stdio: ["ignore", "ignore", "pipe"],
        },
      )

      const abort = () => {
        if (!child.pid) return
        if (process.platform === "win32") {
          const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
          killer.once("error", () => child.kill("SIGKILL"))
        } else {
          try { process.kill(-child.pid, "SIGKILL") } catch { child.kill("SIGKILL") }
        }
      }

      signal?.addEventListener("abort", abort, { once: true })

      child.stderr.resume() // No unbounded stderr buffering or provider URLs in errors.

      child.once("error", () => {
        signal?.removeEventListener("abort", abort)
        reject(
          new AppError(
            503,
            "MEDIA_COMPUTE_UNAVAILABLE",
            "Không thể khởi chạy Python media worker",
          ),
        )
      })

      child.once("close", (code) => {
        signal?.removeEventListener("abort", abort)

        if (signal?.aborted) return reject(signal.reason)

        if (code !== 0)
          return reject(
            new AppError(
              502,
              "DEMUCS_FAILED",
              `Media worker exit code ${code}`,
            ),
          )

        resolve()
      })
    })
  }
}

export class AzureContainerAppsMediaProvider implements MediaComputeProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep = (ms: number, signal?: AbortSignal) =>
      delay(ms, undefined, { signal }),
  ) {}

  private async token(signal?: AbortSignal): Promise<string> {
    const endpoint = process.env.IDENTITY_ENDPOINT

    const header = process.env.IDENTITY_HEADER

    if (!endpoint || !header)
      throw new AppError(
        503,
        "MEDIA_IDENTITY_UNAVAILABLE",
        "Container App cần managed identity để start Job",
      )

    const url = new URL(endpoint)
    url.searchParams.set("resource", "https://management.azure.com/")
    url.searchParams.set("api-version", "2019-08-01")
    if (env.AZURE_CLIENT_ID) url.searchParams.set("client_id", env.AZURE_CLIENT_ID)

    const response = await this.fetchImpl(url, {
      headers: { "X-IDENTITY-HEADER": header },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    })

    const body = (await response.json()) as { access_token?: string }

    if (!response.ok || !body.access_token)
      throw new AppError(
        503,
        "MEDIA_IDENTITY_UNAVAILABLE",
        "Không lấy được managed identity token",
      )

    return body.access_token
  }

  async separateVocals(
    _input: string,
    output: string,
    signal?: AbortSignal,
    context?: MediaJobContext,
  ): Promise<void> {
    if (!context || !env.AZURE_MEDIA_JOB_RESOURCE_ID)
      throw new AppError(
        503,
        "MEDIA_JOB_NOT_CONFIGURED",
        "Thiếu Azure media Job resource ID hoặc input contract",
      )

    try {
      if ((await confirmR2Object(context.outputKey)).sizeBytes > 44) {
        await downloadR2Object(context.outputKey, output)
        return
      }
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404 &&
        (error as Error).name !== "NotFound"
      )
        throw error
    }

    if (context.started && !context.execution)
      throw new AppError(
        409,
        "MEDIA_JOB_SUBMISSION_UNCERTAIN",
        "Job start chưa xác định; không khởi chạy lần hai",
      )

    const base = `https://management.azure.com${env.AZURE_MEDIA_JOB_RESOURCE_ID}`

    const version = "api-version=2025-01-01"

    const request = async (url: string, method = "GET", body?: unknown) => {
      if (new URL(url).origin !== "https://management.azure.com")
        throw new AppError(
          502,
          "MEDIA_JOB_INVALID_URL",
          "Azure Job URL không hợp lệ",
        )
      const token = await this.token(signal)

      const response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },

        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000),
        redirect: "error",
      })

      if (!response.ok)
        throw new AppError(
          502,
          "MEDIA_JOB_API_FAILED",
          `Azure Job HTTP ${response.status}; start không được tự retry`,
        )

      const result = (await response
        .json()
        .catch(() => ({}))) as AzureJobResponse
      if (response.status === 202)
        result.location = response.headers.get("location") ?? undefined
      return result
    }

    let execution = context.execution

    if (!execution) {
      const job = await request(`${base}?${version}`)

      const template = job.properties?.template

      if (
        !Array.isArray(template?.containers) ||
        template.containers.length !== 1
      )
        throw new AppError(
          503,
          "MEDIA_JOB_TEMPLATE_INVALID",
          "Media Job cần đúng một container",
        )

      const container = template.containers[0]!

      container.args = ["r2-separate-vocals"]

      container.env = [
        ...(container.env ?? []).filter(
          (e: { name: string }) =>
            !["MEDIA_INPUT_KEY", "MEDIA_OUTPUT_KEY"].includes(e.name),
        ),
        { name: "MEDIA_INPUT_KEY", value: context.inputKey },
        { name: "MEDIA_OUTPUT_KEY", value: context.outputKey },
      ]

      await context.beforeStart()

      const started = await request(
        `${base}/start?${version}`,
        "POST",
        template,
      )

      execution =
        typeof started.name === "string"
          ? started.name
          : started.location
            ? `operation:${started.location}`
            : undefined
      if (!execution)
        throw new AppError(
          502,
          "MEDIA_JOB_SUBMISSION_UNCERTAIN",
          "Azure Job không trả execution name",
        )

      await context.onStarted(execution)
    }

    const deadline = Date.now() + env.MEDIA_JOB_TIMEOUT_SECONDS * 1000

    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      if (execution.startsWith("operation:")) {
        const operation = await request(execution.slice("operation:".length))
        if (operation.name) {
          execution = operation.name
          await context.onStarted(execution)
        } else {
          await this.sleep(10_000, signal)
          continue
        }
      }
      const result = await request(
        `${base}/executions/${encodeURIComponent(execution)}?${version}`,
      )

      const status = result.properties?.status

      if (status === "Succeeded") {
        await downloadR2Object(context.outputKey, output)
        return
      }

      if (["Failed", "Stopped", "Degraded"].includes(status ?? ""))
        throw new AppError(502, "DEMUCS_FAILED", `Azure media Job ${status}`)

      await this.sleep(10_000, signal)
    }

    throw new AppError(
      504,
      "MEDIA_JOB_TIMEOUT",
      "Media Job quá hạn; execution ID được giữ để resume",
    )
  }
}

export const mediaComputeProvider: MediaComputeProvider = {
  separateVocals: (input, output, signal, context) =>
    (env.MEDIA_COMPUTE_PROVIDER === "azure-container-apps"
      ? new AzureContainerAppsMediaProvider()
      : new LocalMediaComputeProvider()
    ).separateVocals(input, output, signal, context),
}
