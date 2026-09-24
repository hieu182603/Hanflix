// Local FFmpeg/FFprobe smoke test: no database and no cloud services.
import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { probeMedia, extractAudioForASR } from '../src/services/media-processor.js';

const folder = await mkdtemp(path.join(os.tmpdir(), 'hanflix-content-media-'));
const source = path.join(folder, 'podcast.mp3');
const speech = path.join(folder, 'speech.wav');
try {
  const generated = spawnSync(ffmpegInstaller.path, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'anullsrc=r=16000:cl=mono', '-t', '601', '-b:a', '32k', source], { encoding: 'utf8' });
  if (generated.status !== 0) throw new Error(generated.stderr || 'FFmpeg fixture generation failed');
  await assert.rejects(probeMedia(source), { code: 'VIDEO_DURATION_EXCEEDED' });
  const podcast = await probeMedia(source, undefined, { maxDurationSeconds: 5400 });
  assert(podcast.durationSeconds >= 601 && podcast.durationSeconds < 602);
  assert.equal(podcast.videoCodec, undefined);
  await extractAudioForASR(source, speech);
  const wav = await probeMedia(speech, undefined, { maxDurationSeconds: 5400 });
  assert(Math.abs(wav.durationSeconds - podcast.durationSeconds) < 1);
  console.log(JSON.stringify({ ok: true, podcastSeconds: podcast.durationSeconds, extractedSeconds: wav.durationSeconds, defaultDurationLimitRejected: true }));
} finally {
  await unlink(source).catch(() => undefined);
  await unlink(speech).catch(() => undefined);
  await rmdir(folder);
}
