import { describe, expect, it } from 'vitest';
import { canRemuxFaststart, PLAYBACK_DERIVATIVE_VERSION, resolvePlaybackKey } from '../playback-derivative.js';

describe('playback-derivative helpers', () => {
  it('canRemuxFaststart: accepts MP4 H.264 + AAC', () => {
    expect(canRemuxFaststart({ format: 'mp4', videoCodec: 'h264', audioCodec: 'aac', hasAudio: true, hasFaststart: false, width: 1280, height: 720, durationSeconds: 120 })).toBe(true);
  });
  it('canRemuxFaststart: accepts MP4 H.264 + no audio', () => {
    expect(canRemuxFaststart({ format: 'mp4', videoCodec: 'h264', audioCodec: null, hasAudio: false, hasFaststart: false, width: 1280, height: 720, durationSeconds: 120 })).toBe(true);
  });
  it('canRemuxFaststart: rejects MP4 H.265 (must transcode)', () => {
    expect(canRemuxFaststart({ format: 'mp4', videoCodec: 'hevc', audioCodec: 'aac', hasAudio: true, hasFaststart: false, width: 1280, height: 720, durationSeconds: 120 })).toBe(false);
  });
  it('canRemuxFaststart: rejects WebM (must transcode)', () => {
    expect(canRemuxFaststart({ format: 'webm', videoCodec: 'vp9', audioCodec: 'opus', hasAudio: true, hasFaststart: false, width: 1280, height: 720, durationSeconds: 120 })).toBe(false);
  });

  it('resolvePlaybackKey: prefers playbackKey when set', () => {
    expect(resolvePlaybackKey({ playbackKey: 'lessons/abc/playback/v1.mp4', media: { objectKey: 'lessons/abc/source.mp4' } })).toBe('lessons/abc/playback/v1.mp4');
  });
  it('resolvePlaybackKey: falls back to media.objectKey', () => {
    expect(resolvePlaybackKey({ media: { objectKey: 'lessons/abc/source.mp4' } })).toBe('lessons/abc/source.mp4');
  });
  it('resolvePlaybackKey: returns null when neither is set', () => {
    expect(resolvePlaybackKey({})).toBeNull();
  });

  it('exposes a positive integer PLAYBACK_DERIVATIVE_VERSION', () => {
    expect(PLAYBACK_DERIVATIVE_VERSION).toBeGreaterThanOrEqual(1);
  });
});
