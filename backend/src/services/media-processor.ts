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
 * Reads media metadata using ffprobe
 */
export async function probeMedia(filePath: string): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new AppError(422, 'MEDIA_PROBE_FAILED', `Không thể đọc thông tin video: ${err.message}`));
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      const durationSeconds = metadata.format.duration ? Number(metadata.format.duration) : 0;
      const sizeBytes = metadata.format.size ? Number(metadata.format.size) : undefined;
      const bitrate = metadata.format.bit_rate ? Number(metadata.format.bit_rate) : undefined;

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
  });
}

/**
 * Extracts speech audio optimized for ASR (16kHz, mono WAV or MP3)
 */
export async function extractAudioForASR(videoInputPath: string, audioOutputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoInputPath)
      .noVideo()
      .audioFrequency(16000)
      .audioChannels(1)
      .output(audioOutputPath)
      .on('end', () => resolve(audioOutputPath))
      .on('error', (err) => {
        reject(new AppError(500, 'AUDIO_EXTRACTION_FAILED', `Không thể trích xuất âm thanh từ video: ${err.message}`));
      })
      .run();
  });
}

/**
 * Extracts a thumbnail image from video
 */
export async function generateThumbnail(videoInputPath: string, outputFolder: string, filename: string, timemark = '00:00:01'): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoInputPath)
      .screenshots({
        timestamps: [timemark],
        filename,
        folder: outputFolder,
        size: '1280x720',
      })
      .on('end', () => resolve(`${outputFolder}/${filename}`))
      .on('error', (err) => {
        reject(new AppError(500, 'THUMBNAIL_GENERATION_FAILED', `Không thể tạo thumbnail: ${err.message}`));
      });
  });
}
