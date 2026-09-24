import { describe, expect, it } from 'vitest';
import { validateMediaFile } from './media-file-validation';

const samples = [
  { name: 'tagged.mp3', type: 'audio/mpeg', bytes: [73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'untagged.mp3', type: 'audio/mpeg', bytes: [255, 251, 144, 100, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'sample.wav', type: 'audio/wav', bytes: [82, 73, 70, 70, 36, 8, 0, 0, 87, 65, 86, 69] },
  { name: 'sample.wav', type: 'audio/x-wav', bytes: [82, 73, 70, 70, 36, 8, 0, 0, 87, 65, 86, 69] },
  { name: 'sample.m4a', type: 'audio/mp4', bytes: [0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65, 32] },
];

describe('upload file validation', () => {
  it.each(samples)('accepts $name ($type) only when audio is allowed', async ({ name, type, bytes }) => {
    const file = new File([new Uint8Array(bytes)], name, { type });
    expect(await validateMediaFile(file, true)).toBe(true);
    expect(await validateMediaFile(file, false)).toBe(false);
  });

  it.each([
    { type: 'video/mp4', bytes: [0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109] },
    { type: 'video/webm', bytes: [26, 69, 223, 163] },
  ])('continues accepting $type videos', async ({ type, bytes }) => {
    expect(await validateMediaFile(new File([new Uint8Array(bytes)], 'video', { type }), false)).toBe(true);
  });

  it('rejects a renamed text file and a RIFF container that is not WAVE', async () => {
    expect(await validateMediaFile(new File(['not an mp3'], 'fake.mp3', { type: 'audio/mpeg' }), true)).toBe(false);
    expect(await validateMediaFile(new File(['RIFF0000AVI '], 'fake.wav', { type: 'audio/wav' }), true)).toBe(false);
  });
});
