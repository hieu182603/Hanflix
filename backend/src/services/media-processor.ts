import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { accessSync, constants } from 'node:fs';
import { AppError } from '../errors/app-error.js';

function executableOrSystem(installerPath: string | undefined, systemCommand: string) {
  if (installerPath) {
    try {
      accessSync(installerPath, constants.X_OK);
      return installerPath;
    } catch {
      // Some Linux npm binary packages are readable but not executable by the non-root runtime user.
    }
  }
  return systemCommand;
}

ffmpeg.setFfmpegPath(executableOrSystem(ffmpegInstaller?.path, 'ffmpeg'));
ffmpeg.setFfprobePath(executableOrSystem(ffprobeInstaller?.path, 'ffprobe'));

export interface MediaMetadata {
  durationSeconds: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrate?: number;
  sizeBytes?: number;
}

/**
 * F04 fix (2026-09-18): abort signal wiring for FFmpeg operations.
 *
 * fluent-ffmpeg does NOT expose an AbortSignal hook. We wrap every call so
 * we can:
 *   1) reject the promise early if `signal.aborted` is already set
 *   2) listen for `signal.abort` and `command.kill('SIGKILL')` the spawned
 *      ffmpeg process tree
 *   3) surface an `AbortError` (matching the standard shape) so callers can
 *      distinguish user/system cancellation from real ffmpeg failures
 *
 * Without this, a stuck ffmpeg (e.g. malformed input that ffprobe accepts but
 * audio extraction hangs on) can hold the worker for 30 minutes until the lease
 * expires. With this, cancellation is sub-second.
 */
function bindAbort(signal: AbortSignal | undefined, command: { kill: (signal: string) => unknown } | undefined): void {
  if (!signal || !command) return;
  if (signal.aborted) {
    try { command.kill('SIGKILL'); } catch { /* process may have already exited */ }
    return;
  }
  signal.addEventListener('abort', () => {
    try { command.kill('SIGKILL'); } catch { /* process may have already exited */ }
  }, { once: true });
}

class MediaAbortedError extends Error {
  override readonly name = 'MediaAbortedError';
  readonly code = 'MEDIA_ABORTED';
  constructor(reason?: unknown) {
    super(reason instanceof Error ? reason.message : 'Media operation aborted');
  }
}

export async function probeMedia(filePath: string, signal?: AbortSignal): Promise<MediaMetadata> {
  if (signal?.aborted) throw new MediaAbortedError(signal.reason);
  // F04: ffprobe is callback-based and doesn't return a kill-able process handle.
  // We handle abort by checking `signal.aborted` at start, after promise creation,
  // and on a periodic timer (in case the probe is hung). Each check rejects the
  // promise immediately.
  if (signal?.aborted) throw new MediaAbortedError(signal.reason);
  let probeAborted = false;
  let probeAbortTimer: NodeJS.Timeout | undefined;
  if (signal) {
    const onAbort = () => { probeAborted = true; };
    signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await new Promise<MediaMetadata>((resolve, reject) => {
      const tryReject = () => {
        if (probeAborted && signal) reject(new MediaAbortedError(signal.reason));
      };
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (probeAbortTimer) clearInterval(probeAbortTimer);
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        if (err) {
          return reject(new AppError(422, 'MEDIA_PROBE_FAILED', `Không thể đọc thông tin video: ${err.message}`));
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        const durationSeconds = metadata.format.duration ? Number(metadata.format.duration) : 0;
        const sizeBytes = metadata.format.size ? Number(metadata.format.size) : undefined;
        const bitrate = metadata.format.bit_rate ? Number(metadata.format.bit_rate) : undefined;

        // SECURITY: Hard limits enforced regardless of upstream admin validation.
        const MAX_DURATION_SECONDS = 600; // 10 minutes absolute ceiling
        const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
        if (durationSeconds > MAX_DURATION_SECONDS) {
          return reject(new AppError(
            413,
            'VIDEO_DURATION_EXCEEDED',
            `Video vượt quá thời lượng tối đa ${MAX_DURATION_SECONDS / 60} phút.`,
          ));
        }
        if (sizeBytes !== undefined && sizeBytes > MAX_SIZE_BYTES) {
          return reject(new AppError(
            413,
            'VIDEO_SIZE_EXCEEDED',
            `Video vượt quá dung lượng tối đa ${MAX_SIZE_BYTES / 1024 / 1024}MB.`,
          ));
        }

        resolve({
          durationSeconds: Math.round(durationSeconds * 100) / 100,
          width: videoStream?.width,
          height: videoStream?.height,
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          bitrate,
          sizeBytes,
        });
      });
      // F04: poll signal every 500ms while ffprobe runs. If signal fires, we
      // reject the outer promise. The underlying ffprobe process will eventually
      // complete on its own; the worker has already moved on to cleanup.
      if (signal) {
        probeAbortTimer = setInterval(() => {
          if (signal.aborted) {
            clearInterval(probeAbortTimer!);
            tryReject();
          }
        }, 500);
        probeAbortTimer.unref();
      }
    });
  } finally {
    if (probeAbortTimer) clearInterval(probeAbortTimer);
  }
}

export async function extractAudioForASR(videoInputPath: string, audioOutputPath: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new MediaAbortedError(signal.reason);
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoInputPath)
      .noVideo()
      .audioFrequency(16000)
      .audioChannels(1)
      .output(audioOutputPath)
      .on('end', () => {
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        resolve(audioOutputPath);
      })
      .on('error', (err) => {
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        reject(new AppError(500, 'AUDIO_EXTRACTION_FAILED', `Không thể trích xuất âm thanh từ video: ${err.message}`));
      });
    bindAbort(signal, command);
    command.run();
  });
}

export async function generateThumbnail(videoInputPath: string, outputFolder: string, filename: string, timemark = '00:00:01', signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new MediaAbortedError(signal.reason);
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoInputPath)
      .screenshots({
        timestamps: [timemark],
        filename,
        folder: outputFolder,
        size: '1280x720',
      })
      .on('end', () => {
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        resolve(`${outputFolder}/${filename}`);
      })
      .on('error', (err) => {
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        reject(new AppError(500, 'THUMBNAIL_GENERATION_FAILED', `Không thể tạo thumbnail: ${err.message}`));
      });
    bindAbort(signal, command);
  });
}
