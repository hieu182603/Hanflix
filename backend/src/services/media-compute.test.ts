import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { env } from "../config/env.js"
import { AzureContainerAppsMediaProvider } from "./media-compute.js"
import { downloadR2Object, confirmR2Object } from "./r2.js"
vi.mock("./r2.js", () => ({
  downloadR2Object: vi.fn(),
  confirmR2Object: vi.fn(),
}))
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
beforeEach(() => {
  vi.clearAllMocks()
  env.AZURE_MEDIA_JOB_RESOURCE_ID =
    "/subscriptions/test/resourceGroups/test/providers/Microsoft.App/jobs/media"
  vi.stubEnv("IDENTITY_ENDPOINT", "http://localhost/identity")
  vi.stubEnv("IDENTITY_HEADER", "secret")
  env.AZURE_CLIENT_ID = "00000000-0000-4000-8000-000000000001"
  vi.mocked(confirmR2Object).mockRejectedValue(
    Object.assign(new Error(), { name: "NotFound" }),
  )
})
afterEach(() => vi.unstubAllEnvs())
const context = () => ({
  inputKey: "processing/input.wav",
  outputKey: "processing/vocals.wav",
  beforeStart: vi.fn().mockResolvedValue(undefined),
  onStarted: vi.fn().mockResolvedValue(undefined),
})
it("starts real template override, preserves secrets, persists execution before polling and restores output", async () => {
  const ctx = context()
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).startsWith("http://localhost")) {
      expect(new URL(url).searchParams.get("client_id")).toBe(env.AZURE_CLIENT_ID)
      return response({ access_token: "token" })
    }
    if (String(url).includes("/start?")) {
      expect(ctx.beforeStart).toHaveBeenCalledOnce()
      const template = JSON.parse(String(init?.body))
      expect(template.containers[0].env).toContainEqual({
        name: "R2_SECRET_ACCESS_KEY",
        secretRef: "r2-secret",
      })
      expect(template.containers[0].args).toEqual(["r2-separate-vocals"])
      return response({ name: "execution-1" })
    }
    if (String(url).includes("/executions/")) {
      expect(ctx.onStarted).toHaveBeenCalledWith("execution-1")
      return response({ properties: { status: "Succeeded" } })
    }
    return response({
      properties: {
        template: {
          containers: [
            {
              name: "media",
              image: "image",
              env: [{ name: "R2_SECRET_ACCESS_KEY", secretRef: "r2-secret" }],
            },
          ],
        },
      },
    })
  })
  await new AzureContainerAppsMediaProvider(fetchMock).separateVocals(
    "input",
    "output",
    undefined,
    ctx,
  )
  expect(downloadR2Object).toHaveBeenCalledWith(ctx.outputKey, "output")
  expect(
    fetchMock.mock.calls.filter((c) => c[1]?.method === "POST"),
  ).toHaveLength(1)
})
it("resumes execution without start and does not replay uncertain submission", async () => {
  const fetchMock = vi.fn(async (url) =>
    String(url).startsWith("http://localhost")
      ? response({ access_token: "token" })
      : response({ properties: { status: "Succeeded" } }),
  )
  const provider = new AzureContainerAppsMediaProvider(fetchMock)
  await provider.separateVocals("input", "output", undefined, {
    ...context(),
    started: true,
    execution: "known",
  })
  expect(
    fetchMock.mock.calls.every((c) => !String(c[0]).includes("/start")),
  ).toBe(true)
  await expect(
    provider.separateVocals("input", "output", undefined, {
      ...context(),
      started: true,
    }),
  ).rejects.toMatchObject({ code: "MEDIA_JOB_SUBMISSION_UNCERTAIN" })
})
it("reuses durable output without any compute call", async () => {
  vi.mocked(confirmR2Object).mockResolvedValue({ sizeBytes: 1000 })
  const fetchMock = vi.fn()
  await new AzureContainerAppsMediaProvider(fetchMock).separateVocals(
    "in",
    "out",
    undefined,
    context(),
  )
  expect(fetchMock).not.toHaveBeenCalled()
})
it("handles asynchronous start Location and resumes operation polling", async () => {
  const ctx = context()
  const fetchMock = vi.fn(async (url) => {
    const value = String(url)
    if (value.startsWith("http://localhost"))
      return response({ access_token: "token" })
    if (value.includes("/start?"))
      return new Response(null, {
        status: 202,
        headers: { location: "https://management.azure.com/operation/1" },
      })
    if (value.includes("/operation/1")) return response({ name: "execution-2" })
    if (value.includes("/executions/"))
      return response({ properties: { status: "Succeeded" } })
    return response({
      properties: { template: { containers: [{ name: "media" }] } },
    })
  })
  await new AzureContainerAppsMediaProvider(fetchMock).separateVocals(
    "in",
    "out",
    undefined,
    ctx,
  )
  expect(ctx.onStarted).toHaveBeenNthCalledWith(
    1,
    "operation:https://management.azure.com/operation/1",
  )
  expect(ctx.onStarted).toHaveBeenLastCalledWith("execution-2")
})
