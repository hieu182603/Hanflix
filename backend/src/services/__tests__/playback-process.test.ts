import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { __test__, canCopyVideo, canRemuxFaststart, playbackDeadlineMs, probeForDerivative, type ProbeSummary } from '../playback-derivative.js';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), output: '' }));
vi.mock('node:child_process', () => ({ spawn: (...args: unknown[]) => mocks.spawn(...args) }));
const probe: ProbeSummary = { format: 'mp4', videoCodec: 'h264', audioCodec: 'opus', hasAudio: true, hasFaststart: false, width: 1280, height: 720, durationSeconds: 82, pixelFormat: 'yuv420p' };
beforeEach(() => {
  vi.clearAllMocks();
  env.PLAYBACK_DERIVATIVE_MAX_HEIGHT = 720;
  env.VIDEO_STAGE_DEADLINE_PLAYBACK_MS = 900000;
  mocks.output = '';
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
    queueMicrotask(() => { child.stdout.emit('data', Buffer.from(mocks.output)); child.emit('close', 0); });
    return child;
  });
});
it('recognizes the actual ffprobe MP4 alias list and enables H.264/AAC remux', async () => {
  mocks.output = JSON.stringify({ format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '82' }, streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1280, height: 720 }, { codec_type: 'audio', codec_name: 'aac' }] });
  const result = await probeForDerivative('source.mp4');
  expect(result?.format).toBe('mp4');
  expect(canRemuxFaststart(result!)).toBe(true);
});
it('copies H.264 and converts only Opus audio to AAC', async () => {
  await __test__.transcodeFaststart('source.mp4', 'output.mp4', probe);
  const args = mocks.spawn.mock.calls[0]![1] as string[];
  expect(args.slice(args.indexOf('-c:v'), args.indexOf('-c:v') + 2)).toEqual(['-c:v', 'copy']);
  expect(args.slice(args.indexOf('-c:a'), args.indexOf('-c:a') + 2)).toEqual(['-c:a', 'aac']);
  expect(args).not.toContain('-vf');
  expect(args).toContain('+faststart');
});
it.each([{ videoCodec: 'vp9' }, { height: 1080 }, { pixelFormat: 'yuv420p10le' }])('encodes video when copying is unsuitable: %j', async (change) => {
  const input = { ...probe, ...change };
  expect(canCopyVideo(input)).toBe(false);
  await __test__.transcodeFaststart('source.mp4', 'output.mp4', input);
  expect(mocks.spawn.mock.calls[0]![1]).toContain('libx264');
});
it('propagates cancellation instead of treating an aborted encode as an optional failure', async () => {
  const controller = new AbortController();
  controller.abort(new Error('STAGE_DEADLINE_EXCEEDED'));
  await expect(__test__.transcodeFaststart('source.mp4', 'output.mp4', probe, controller.signal)).rejects.toThrow('STAGE_DEADLINE_EXCEEDED');
});
it('scales playback time independently of the 60-second finalize limit, with a finite cap', () => {
  expect(playbackDeadlineMs(197)).toBe(900000);
  expect(playbackDeadlineMs(600)).toBe(2460000);
  expect(playbackDeadlineMs(5400)).toBe(3600000);
  expect(playbackDeadlineMs(NaN)).toBe(900000);
});
