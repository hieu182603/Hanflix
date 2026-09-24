import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { accessSync, constants } from 'node:fs';
import { execFile } from 'node:child_process';
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
  sampleRate?: number;
  channels?: number;
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

export async function probeMedia(filePath: string, signal?: AbortSignal, limits: { minDurationSeconds?: number; maxDurationSeconds?: number } = {}): Promise<MediaMetadata> {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(60_000);
  const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const output = await new Promise<string>((resolve, reject) => {
    execFile(executableOrSystem(ffprobeInstaller?.path, 'ffprobe'),
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath],
      { windowsHide: true, signal: bounded, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
        if (bounded.aborted) return reject(new MediaAbortedError(bounded.reason));
        if (error) return reject(new AppError(422, 'MEDIA_PROBE_FAILED', 'Không thể đọc thông tin media bằng FFprobe'));
        resolve(stdout);
      });
  });
  const metadata = JSON.parse(output) as ffmpeg.FfprobeData;
  const video = metadata.streams.find(s => s.codec_type === 'video');
  const audio = metadata.streams.find(s => s.codec_type === 'audio');
  const durationSeconds = Number(metadata.format.duration ?? 0);
  const sizeBytes = Number(metadata.format.size ?? 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new AppError(422, 'INVALID_MEDIA_DURATION', 'Không đọc được thời lượng nội dung');
  if (limits.minDurationSeconds && durationSeconds < limits.minDurationSeconds) {
    throw new AppError(422, 'VIDEO_DURATION_TOO_SHORT', `Video quá ngắn (${Math.round(durationSeconds)}s). Thời lượng video phải từ 1 phút đến 10 phút (60s – 600s)`);
  }
  if (durationSeconds > (limits.maxDurationSeconds ?? 600)) throw new AppError(413, 'VIDEO_DURATION_EXCEEDED', 'Video vượt quá thời lượng tối đa cho phép');
  if (sizeBytes > 200 * 1024 * 1024) throw new AppError(413, 'VIDEO_SIZE_EXCEEDED', 'Media vượt quá dung lượng tối đa 200MB');
  return { durationSeconds: Math.round(durationSeconds * 100) / 100, width: video?.width, height: video?.height,
    videoCodec: video?.codec_name, audioCodec: audio?.codec_name, sampleRate: Number(audio?.sample_rate), channels: audio?.channels,
    bitrate: Number(metadata.format.bit_rate) || undefined, sizeBytes };
}

export async function extractAudioForASR(videoInputPath: string, audioOutputPath: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new MediaAbortedError(signal.reason);
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoInputPath)
      .noVideo()
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
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

export async function validateAsrAudio(filePath: string, signal?: AbortSignal): Promise<MediaMetadata> {
  const metadata = await probeMedia(filePath, signal);
  if (!metadata.sizeBytes || metadata.sizeBytes <= 44 || metadata.sampleRate !== 16000 || metadata.channels !== 1 || metadata.audioCodec !== 'pcm_s16le') {
    throw new AppError(422, 'INVALID_ASR_AUDIO', 'ASR yêu cầu PCM WAV 16kHz mono với dữ liệu audio hợp lệ');
  }
  return metadata;
}

/** Preserve music source quality for optional Demucs separation. */
export async function extractAudioForSeparation(videoInputPath: string, audioOutputPath: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new MediaAbortedError(signal.reason);
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoInputPath)
      .noVideo()
      .audioFrequency(44100)
      .audioChannels(2)
      .audioCodec('pcm_s16le')
      .format('wav')
      .output(audioOutputPath)
      .on('end', () => {
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        resolve(audioOutputPath);
      })
      .on('error', (err) => {
        if (signal?.aborted) return reject(new MediaAbortedError(signal.reason));
        reject(new AppError(500, 'AUDIO_SEPARATION_SOURCE_FAILED', `Không thể chuẩn bị audio cho vocal separation: ${err.message}`));
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
