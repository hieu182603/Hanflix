import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import { writeFile, mkdir } from "node:fs/promises"

// Deliberately excludes the real .env and every provider credential.
await mkdir(".runtime", { recursive: true })
await writeFile(".runtime/empty.env", "")
const child = spawn(process.execPath, ["dist/server.js"], {
  windowsHide: true,
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    DOTENV_CONFIG_PATH: ".runtime/empty.env",
    NODE_ENV: "test",
    PORT: "4019",
    MONGODB_URI:
      "mongodb://127.0.0.1:27029/hanflix_runtime_audit?replicaSet=pipelineAudit",
    MONGODB_DB_NAME: "hanflix_runtime_audit",
    MONGODB_TLS: "false",
    VIDEO_WORKER_MODE: "disabled",
    JWT_ACCESS_SECRET: "local-runtime-access-01234567890123456789",
    JWT_REFRESH_SECRET: "local-runtime-refresh-01234567890123456789",
  },
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = ""
child.stdout.on("data", (data) => {
  logs = (logs + data).slice(-8000)
})
child.stderr.on("data", (data) => {
  logs = (logs + data).slice(-8000)
})
try {
  let ready = false
  for (let i = 0; i < 50; i++) {
    if (child.exitCode != null)
      throw new Error(`Backend exited ${child.exitCode}: ${logs}`)
    try {
      const result = await fetch("http://127.0.0.1:4019/api/v1/health", {
        signal: AbortSignal.timeout(1000),
      })
      if (result.ok && (await result.json()).data.database === "connected") {
        ready = true
        break
      }
    } catch {
      /* Server is still starting. */
    }
    await delay(200)
  }
  if (!ready) throw new Error(`Backend readiness failed: ${logs}`)
  const health = await fetch("http://127.0.0.1:4019/health")
  if (!health.ok || (await health.json()).status !== "ok")
    throw new Error("Liveness failed")
  console.log(
    "PASS: compiled server starts; /health=200; /api/v1/health=200; MongoDB connected; cloud credentials absent",
  )
  console.log(logs.trim())
} finally {
  child.kill("SIGTERM")
}
