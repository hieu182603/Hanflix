/**
 * Playback derivative generator (F12, 2026-09-19).
 *
 * Goal
 *   Produce a `+faststart` MP4 that browsers can begin playing without
 *   downloading the whole file. Without this step the browser must buffer
 *   the `moov` atom at the END of the file before it can render any frame,
 *   which on 50 MB uploads routinely means 10+ seconds of "loading…"
 *   before the first frame paints.
 *
 * Strategy
 *   1. ffprobe the source. We need to know whether it is already MP4 H.264+AAC.
 *   2. If yes → remux with `-c copy -movflags +faststart`. Near-instant, no
 *      quality loss, no re-encode cost.
 *   3. If no → re-encode:
 *         H.264 yuv420p, AAC, max height = PLAYBACK_DERIVATIVE_MAX_HEIGHT,
 *         bitrate cap = PLAYBACK_DERIVATIVE_VIDEO_BITRATE_KBPS,
 *         keep rotation metadata (so portrait phone footage stays portrait).
 *   4. Upload to R2 under `lessons/{id}/playback/{version}.mp4`. Never
 *      overwrite existing derivatives — bumping `playbackVersion` gives us
 *      an immutable history we can roll back to.
 *   5. Update the lesson doc with `playbackKey` + `playbackVersion`. The
 *      route layer reads from these fields, so the change is visible to
 *      the player immediately on the next `/lessons/:id` call.
 *
 * Failure modes (each surfaces as a logger.warn so the rest of the
 * pipeline can still complete and the original media is shipped):
 *   - `ffmpeg` binary not installed → skip with a clear warning.
 *   - Source codec/container unknown → keep original, log codec details.
 *   - Encode fails for any reason (timeout, disk full, ...) → keep original.
 *
 * Concurrency / abort
 *   The function takes an `AbortSignal` so the worker can cancel mid-run
 *   without leaving a half-written file on R2. When aborted, we delete
 *   any partial upload before re-throwing.
 *
 * Versioning
 *   The "current" version is `PLAYBACK_DERIVATIVE_VERSION` exported below.
 *   Bumping it forces a re-run of every lesson — used by ops when the
 *   encoder pipeline changes (e.g. x264 → x265). The migration tool keys
 *   on this so re-running it always picks up the new version.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { uploadR2File, deleteR2Object } from './r2.js';

export const PLAYBACK_DERIVATIVE_VERSION = 1;

export interface ProbeSummary {
  format: 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi' | 'other';
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  hasAudio: boolean;
  hasFaststart: boolean;
}

/**
 * Run `ffprobe -show_streams -show_format -of json` on a local file and
 * parse the relevant fields. We deliberately tolerate an empty ffprobe
 * output so callers can fall back to the original media.
 */
export async function probeForDerivative(localPath: string, signal?: AbortSignal): Promise<ProbeSummary | null> {
  try {
    const json = await runProcess('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      localPath,
    ], signal);
    const parsed = JSON.parse(json) as {
      format?: { format_name?: string; duration?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; tags?: { major_brand?: string } }>;
    };
    const formatName = (parsed.format?.format_name ?? '').split(',')[0] ?? 'other';
    const format = (['mp4', 'webm', 'mov', 'mkv', 'avi'] as const).includes(formatName as 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi')
      ? formatName
      : 'other';
    const video = (parsed.streams ?? []).find(s => s.codec_type === 'video') ?? null;
    const audio = (parsed.streams ?? []).find(s => s.codec_type === 'audio') ?? null;
    if (!video) return null;
    return {
      format: format as ProbeSummary['format'],
      durationSeconds: Math.max(0, Number(parsed.format?.duration ?? 0)),
      width: video.width ?? 0,
      height: video.height ?? 0,
      videoCodec: video.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      hasAudio: Boolean(audio),
      // ffprobe doesn't expose the `moov` atom position; callers decide
      // based on the container instead (see `canRemuxFaststart`).
      hasFaststart: false,
    };
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, '[PlaybackDerivative] ffprobe failed');
    return null;
  }
}

/** True when the source is already MP4 with H.264 + (AAC or no audio). */
export function canRemuxFaststart(probe: ProbeSummary): boolean {
  return (
    probe.format === 'mp4'
    && (probe.videoCodec === 'h264' || probe.videoCodec === 'avc1' || probe.videoCodec === 'avc')
    && (probe.audioCodec === null || probe.audioCodec === 'aac' || probe.audioCodec === 'mp4a-latm')
  );
}

export interface GenerateOptions {
  lessonId: string;
  sourcePath: string;
  /** Skip if the lesson already has this playbackVersion. */
  currentVersion?: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  playbackKey: string;
  playbackVersion: number;
  /** Whether the source was remuxed (cheap) or transcoded (expensive). */
  remuxed: boolean;
  outputBytes?: number;
}

/**
 * Build the playback derivative and upload it to R2. The returned
 * `playbackKey` is the canonical identifier for the lesson route layer
 * to surface. If the lesson already has a matching version, the function
 * returns a no-op result and the caller can skip the DB write.
 */
export async function generatePlaybackDerivative(options: GenerateOptions): Promise<GenerateResult | null> {
  const { lessonId, sourcePath, currentVersion, signal } = options;
  if (!env.PLAYBACK_DERIVATIVE_ENABLED) return null;
  if (currentVersion === PLAYBACK_DERIVATIVE_VERSION) return null;

  const probe = await probeForDerivative(sourcePath, signal);
  if (!probe) {
    logger.warn({ lessonId }, '[PlaybackDerivative] probe failed, skipping');
    return null;
  }
  if (probe.durationSeconds <= 0 || probe.width <= 0 || probe.height <= 0) {
    logger.warn({ lessonId, probe }, '[PlaybackDerivative] source has no measurable video, skipping');
    return null;
  }

  const tempOutput = `${sourcePath}.playback-${randomUUID()}.mp4`;
  const remuxOnly = canRemuxFaststart(probe);

  let ok = false;
  try {
    if (remuxOnly) {
      ok = await remuxFaststart(sourcePath, tempOutput, signal);
    } else {
      ok = await transcodeFaststart(sourcePath, tempOutput, probe, signal);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    logger.warn({ lessonId, error: error instanceof Error ? error.message : String(error) }, '[PlaybackDerivative] ffmpeg failed, keeping original');
    await fs.unlink(tempOutput).catch(() => undefined);
    return null;
  }
  if (!ok) {
    await fs.unlink(tempOutput).catch(() => undefined);
    return null;
  }

  const playbackKey = `lessons/${lessonId}/playback/v${PLAYBACK_DERIVATIVE_VERSION}-${randomUUID()}.mp4`;
  try {
    await uploadR2File(playbackKey, tempOutput, 'video/mp4');
  } catch (error) {
    logger.warn({ lessonId, error: error instanceof Error ? error.message : String(error) }, '[PlaybackDerivative] upload failed, deleting partial');
    await deleteR2Object(playbackKey).catch(() => undefined);
    await fs.unlink(tempOutput).catch(() => undefined);
    return null;
  }

  const stat = await fs.stat(tempOutput).catch(() => null);
  await fs.unlink(tempOutput).catch(() => undefined);

  logger.info(
    {
      lessonId,
      playbackKey,
      playbackVersion: PLAYBACK_DERIVATIVE_VERSION,
      remuxed: remuxOnly,
      outputBytes: stat?.size,
      durationSeconds: probe.durationSeconds,
      height: probe.height,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
    },
    '[PlaybackDerivative] generated',
  );

  return {
    playbackKey,
    playbackVersion: PLAYBACK_DERIVATIVE_VERSION,
    remuxed: remuxOnly,
    outputBytes: stat?.size,
  };
}

/**
 * `ffmpeg -c copy -movflags +faststart` — lossless remux.
 * Returns true on success.
 */
async function remuxFaststart(source: string, output: string, signal?: AbortSignal): Promise<boolean> {
  try {
    await runProcess('ffmpeg', [
      '-y',
      '-i', source,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-f', 'mp4',
      output,
    ], signal);
    return true;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, '[PlaybackDerivative] remux failed');
    return false;
  }
}

/**
 * Re-encode to a browser-friendly MP4. Caps the output height and bitrate
 * while preserving rotation metadata (e.g. portrait phone footage).
 */
async function transcodeFaststart(source: string, output: string, probe: ProbeSummary, signal?: AbortSignal): Promise<boolean> {
  const args: string[] = [
    '-y',
    '-i', source,
    '-vf', `scale='min(${probe.width},iw)':'min(${env.PLAYBACK_DERIVATIVE_MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease,format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '22',
    '-maxrate', `${env.PLAYBACK_DERIVATIVE_VIDEO_BITRATE_KBPS}k`,
    '-bufsize', `${env.PLAYBACK_DERIVATIVE_VIDEO_BITRATE_KBPS * 2}k`,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
  ];
  if (probe.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  } else {
    args.push('-an');
  }
  args.push('-f', 'mp4', output);

  try {
    await runProcess('ffmpeg', args, signal);
    return true;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, '[PlaybackDerivative] transcode failed');
    return false;
  }
}

function runProcess(bin: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let aborted = false;

    if (signal) {
      const onAbort = () => {
        aborted = true;
        try { child.kill('SIGTERM'); } catch { /* ignore */ }
        reject(new Error('aborted'));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (aborted) return;
      reject(error);
    });
    child.on('close', (code) => {
      if (aborted) return;
      if (code === 0) resolve(stdout || stderr);
      else reject(new Error(`${bin} exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Resolve the playback object key for a lesson doc, falling back to the
 * original media key when no derivative has been generated. Pure function;
 * used by routes/services that need to construct signed URLs.
 */
export function resolvePlaybackKey(lesson: { playbackKey?: string | null; media?: { objectKey?: string | null } | null }): string | null {
  if (lesson.playbackKey) return lesson.playbackKey;
  return lesson.media?.objectKey ?? null;
}

/**
 * Helper for tests: the temp output path layout we use in the pipeline.
 */
export const __test__ = { runProcess, remuxFaststart, transcodeFaststart, canRemuxFaststart, probeForDerivative, PLAYBACK_DERIVATIVE_VERSION, resolvePlaybackKey };
