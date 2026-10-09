import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminVideoUploader, { type AdminVideoUploaderProps } from './AdminVideoUploader';

function Harness({ overrides = {} }: { overrides?: Partial<AdminVideoUploaderProps> }) {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(120);
  const noop = () => {};
  const props: AdminVideoUploaderProps = {
    activeTab: 'upload', onTabChange: noop, titleVi: '', setTitleVi: noop,
    titleZh: '', setTitleZh: noop, descriptionVi: '', setDescriptionVi: noop,
    hsk: 1, setHsk: noop, autoGenerateQuizCount: '', setAutoGenerateQuizCount: noop,
    topic: 'daily-life', setTopic: noop, duration, setDuration, file, setFile,
    busy: false, uploadStage: 'idle', uploadProgress: { percent: 0, bytesSent: 0, totalBytes: 0 },
    uploadError: '', onSubmitUpload: noop, onCancelUpload: noop, jobs: [], lessons: [],
    onSelectLesson: noop, onRetryProcessing: async () => {}, onCancelVideoUpload: async () => {},
    lyricsRaw: '', setLyricsRaw: noop, contentMode: 'song', setContentMode: noop,
  };
  return <AdminVideoUploader {...props} {...overrides} />;
}

let media: HTMLVideoElement[];
beforeEach(() => {
  media = [];
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => {
    const element = createElement(tag, options);
    if (tag === 'video') media.push(element as HTMLVideoElement);
    return element;
  }) as typeof document.createElement);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:test');
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const mp4 = () => new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109])], 'video.mp4', { type: 'video/mp4' });

it('marks playback as failed and translation as completed for the saved 73 percent incident', () => {
  const { getByText, queryByText } = render(<Harness overrides={{
    activeTab: 'processing',
    selectedLesson: { _id: 'lesson', titleVi: 'Video lỗi', status: 'failed', hsk: 3, durationSeconds: 197, processingProgress: 73, processingError: 'Stage "inspect_media" vượt quá deadline cho phép' } as AdminVideoUploaderProps['selectedLesson'],
    processingStatus: { status: 'failed', currentStep: 'BUILD_SUBTITLES', stage: 'finalize', stageProgress: 73, attempts: 1, errorCode: 'STAGE_DEADLINE_EXCEEDED' },
  }} />);
  const playback = getByText('5. Tạo Video Phát Lại').parentElement!;
  const translation = getByText('4. Phân Đoạn & Dịch').parentElement!;
  expect(playback.querySelector('.lucide-circle-alert')).not.toBeNull();
  expect(translation.querySelector('.lucide-circle-check')).not.toBeNull();
  expect(queryByText('Stage "inspect_media" vượt quá deadline cho phép')).toBeNull();
  expect(getByText('Tạo video phát lại / hoàn thiện phụ đề vượt quá thời gian xử lý cho phép.')).toBeTruthy();
});

it('clears stale duration and allows a manual value after metadata failure', async () => {
  const { container, getByLabelText } = render(<Harness />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [mp4()] } });
  await waitFor(() => expect(media.length).toBe(1));
  const duration = getByLabelText(/Thời lượng/) as HTMLInputElement;
  const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
  expect(duration.value).toBe('');
  expect(submit.disabled).toBe(true);
  act(() => { media[0].dispatchEvent(new Event('error')); });
  fireEvent.change(duration, { target: { value: '3:22' } });
  expect(duration.value).toBe('3:22');
  expect(submit.disabled).toBe(false);
});

it('ignores metadata from a previous file selection', async () => {
  const { container, getByLabelText } = render(<Harness />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [mp4()] } });
  await waitFor(() => expect(media.length).toBe(1));
  fireEvent.change(input, { target: { files: [mp4()] } });
  await waitFor(() => expect(media.length).toBe(2));
  Object.defineProperty(media[1], 'duration', { value: 180 });
  act(() => { media[1].dispatchEvent(new Event('loadedmetadata')); });
  Object.defineProperty(media[0], 'duration', { value: 30 });
  act(() => { media[0].dispatchEvent(new Event('loadedmetadata')); });
  expect((getByLabelText(/Thời lượng/) as HTMLInputElement).value).toBe('3:00');
});
