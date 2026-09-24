import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let tempDir: string;
let audioPath: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.AZURE_SPEECH_KEY = 'test-key';
  process.env.AZURE_SPEECH_REGION = 'southeastasia';
  process.env.AZURE_SPEECH_ENDPOINT = 'https://speech.example.test';
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanflix-speech-test-'));
  audioPath = path.join(tempDir, 'sample.wav');
  await fs.writeFile(audioPath, Buffer.from('RIFF-test'));
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('AzureSpeechToTextService', () => {
  it('maps phrase timestamps to HanFlix segments', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      durationMilliseconds: 2500,
      combinedPhrases: [{ text: '你好' }],
      phrases: [{
        offsetMilliseconds: 100,
        durationMilliseconds: 900,
        text: '你好',
        confidence: 0.97,
        words: [
          { text: '你好', offsetMilliseconds: 100, durationMilliseconds: 900 },
        ],
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    const { AzureSpeechToTextService } = await import('./azure-speech-to-text.service.js');
    const service = new AzureSpeechToTextService(fetchMock);

    await expect(service.transcribeFile(audioPath)).resolves.toEqual([
      {
        startMs: 100,
        endMs: 1000,
        text: '你好',
        confidence: 0.97,
        words: [{ text: '你好', startMs: 100, endMs: 1000 }],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();

    const callArgs = fetchMock.mock.calls[0]!;
    const requestInit = callArgs[1] as RequestInit & { body: FormData };
    const body = requestInit.body;
    expect(body).toBeInstanceOf(FormData);
    const definitionValue = body.get('definition');
    expect(JSON.parse(String(definitionValue))).toMatchObject({
      locales: ['zh-CN'],
      wordLevelTimestampsEnabled: true,
    });
  });

  it('rejects invalid successful responses instead of creating sample subtitles', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ phrases: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const { AzureSpeechToTextService } = await import('./azure-speech-to-text.service.js');
    const service = new AzureSpeechToTextService(fetchMock);

    await expect(service.transcribeFile(audioPath)).rejects.toMatchObject({ code: 'AZURE_ASR_EMPTY_TRANSCRIPT' });
  });
});
