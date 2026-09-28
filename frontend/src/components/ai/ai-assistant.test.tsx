import { useEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIAssistantDrawer from '../AIAssistantDrawer';
import { LearningAIProvider, useLearningAI, type LearningAISource } from './LearningAIContext';
import type { PandaReply } from '../../api/learning';
import { ApiRequestError } from '../../api/client';

const api = vi.hoisted(() => ({ askPanda: vi.fn(), getPandaHistory: vi.fn(), clearPandaHistory: vi.fn() }));
vi.mock('../../api/learning', () => api);
vi.mock('../panda-pet', () => ({ usePandaPet: () => ({ state: 'idle', triggerReaction: vi.fn(),
  handlePandaAIEvent: vi.fn(), setPandaState: vi.fn() }) }));
const cue = { cueId: 'meal', startMs: 80000, endMs: 85000, zh: '我已经吃过饭了。', pinyin: 'Wǒ yǐjīng chīguo fàn le.', vi: 'Tôi ăn cơm rồi.' };
let playbackMs = 83000;
const source: LearningAISource = { lessonId: 'lesson-a', revision: 3, title: 'Bữa ăn', hskLevel: 2,
  activeCue: cue, status: 'ready', snapshot: () => ({ lessonId: 'lesson-a', subtitleRevision: 3, playbackMs,
    cueId: 'meal', scope: 'current_segment' }), seek: vi.fn() };
const reply: PandaReply = { answerVi: '过 diễn tả trải nghiệm.', citations: [cue], contextStatus: 'ready', grounding: 'transcript',
  context: { ...source.snapshot(), title: source.title, coverage: 'window' }, requestId: 'r1' };
function Register({ value }: { value: LearningAISource }) {
  const { register } = useLearningAI(); useEffect(() => register(value), [register, value]); return null;
}
function Harness({ value = source, open = true, prompt = '', consumed = vi.fn(), close = vi.fn() }) {
  return <LearningAIProvider><Register value={value} />
    <AIAssistantDrawer isOpen={open} onClose={close} initialPrompt={prompt} onPromptConsumed={consumed} currentUser={{ name: 'An' }} />
  </LearningAIProvider>;
}
async function send(question = 'Vì sao dùng 过?') {
  await waitFor(() => expect(screen.queryByText('Đang tải hội thoại…')).toBeNull());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
}
beforeEach(() => {
  vi.clearAllMocks(); playbackMs = 83000;
  Element.prototype.scrollIntoView = vi.fn();
  api.getPandaHistory.mockResolvedValue({ messages: [] }); api.askPanda.mockResolvedValue(reply);
  api.clearPandaHistory.mockResolvedValue({ cleared: true });
});
afterEach(cleanup);

it('sends the live player snapshot and renders verified citation seek controls', async () => {
  const close = vi.fn(); render(<Harness close={close} />);
  await send();
  expect(api.askPanda.mock.calls[0][0]).toMatchObject({ question: 'Vì sao dùng 过?', lessonContext: {
    lessonId: 'lesson-a', subtitleRevision: 3, playbackMs: 83000, cueId: 'meal', scope: 'current_segment' } });
  fireEvent.click(await screen.findByRole('button', { name: /Xem lại 01:20/ }));
  expect(source.seek).toHaveBeenCalledWith(80000); expect(close).toHaveBeenCalled();
});
it('keeps a pinned context while the video continues', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Ghim đoạn này để hỏi tiếp' }));
  playbackMs = 140000;
  await send();
  expect(api.askPanda.mock.calls[0][0].lessonContext.playbackMs).toBe(83000);
});
it('allows whole-lesson and explicitly general questions', async () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Phạm vi câu hỏi'), { target: { value: 'whole_lesson' } });
  await send('Tóm tắt bài này');
  expect(api.askPanda.mock.calls[0][0].lessonContext.scope).toBe('whole_lesson');
  await screen.findByText(reply.answerVi);
  fireEvent.click(screen.getByRole('button', { name: 'Hỏi tiếng Trung chung' }));
  await send('你好 nghĩa là gì?');
  expect(api.askPanda.mock.calls[1][0].lessonContext).toBeUndefined();
});
it('does not automatically send or repeat an initial prompt on reopening', async () => {
  const consumed = vi.fn(); const view = render(<Harness prompt="Giải thích đoạn đang xem" consumed={consumed} />);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Giải thích đoạn đang xem'));
  expect(api.askPanda).not.toHaveBeenCalled();
  view.rerender(<Harness open={false} consumed={consumed} />);
  view.rerender(<Harness open consumed={consumed} />);
  expect(api.askPanda).not.toHaveBeenCalled(); expect(consumed).toHaveBeenCalled();
});
it('restores prior messages after reopening', async () => {
  api.getPandaHistory.mockResolvedValue({ messages: [{ id: 'old', question: 'Câu hỏi cũ', response: reply, createdAt: new Date().toISOString() }] });
  render(<Harness />);
  expect(await screen.findByText('Câu hỏi cũ')).toBeTruthy();
  expect(await screen.findByText(reply.answerVi)).toBeTruthy();
});
it('aborts and discards an old reply after switching lessons', async () => {
  let resolve!: (value: PandaReply) => void;
  api.askPanda.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const view = render(<Harness />); await send();
  const signal: AbortSignal = api.askPanda.mock.calls[0][1];
  const second = { ...source, lessonId: 'lesson-b', title: 'Bài thứ hai', snapshot: () => ({ ...source.snapshot(), lessonId: 'lesson-b' }) };
  view.rerender(<Harness value={second} />);
  expect(signal.aborted).toBe(true);
  resolve({ ...reply, answerVi: 'Phản hồi bài cũ' });
  await waitFor(() => expect(screen.getByText('Bài thứ hai')).toBeTruthy());
  expect(screen.queryByText('Phản hồi bài cũ')).toBeNull();
});
it('shows specific API errors and retries the original snapshot', async () => {
  api.askPanda.mockRejectedValueOnce(new ApiRequestError(504, 'AI_TIMEOUT', 'Panda phản hồi quá lâu.'));
  render(<Harness />); await send();
  expect(await screen.findByText('Panda phản hồi quá lâu.')).toBeTruthy();
  playbackMs = 140000;
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại câu hỏi' }));
  await screen.findByText(reply.answerVi);
  expect(api.askPanda.mock.calls[1][0].lessonContext.playbackMs).toBe(83000);
});
it('returns from general chat to the lesson when a lesson prompt is opened', async () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Hỏi tiếng Trung chung' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Quay lại bài đang xem' })).toBeTruthy());
  view.rerender(<Harness prompt="Giải thích đoạn đang xem" />);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Giải thích đoạn đang xem'));
  await send();
  expect(api.askPanda.mock.calls[0][0].lessonContext.lessonId).toBe('lesson-a');
});
it('clears the current conversation and refreshes the empty history', async () => {
  let cleared = false;
  api.getPandaHistory.mockImplementation(async () => ({ messages: cleared ? [] : [{ id: 'old', question: 'Lịch sử cần xóa', response: reply, createdAt: new Date().toISOString() }] }));
  api.clearPandaHistory.mockImplementation(async () => { cleared = true; return { cleared: true }; });
  render(<Harness />);
  await screen.findByText('Lịch sử cần xóa');
  fireEvent.click(screen.getByRole('button', { name: 'Xóa hội thoại' }));
  await waitFor(() => expect(api.clearPandaHistory).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Lịch sử cần xóa')).toBeNull());
  expect(api.clearPandaHistory.mock.calls[0][0].lessonId).toBe('lesson-a');
});
