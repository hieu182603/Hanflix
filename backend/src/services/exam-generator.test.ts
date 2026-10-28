import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamModel } from '../models/exam.model.js';
import { examSeeds } from '../data/exam-seeds.js';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('./gemini.js', async original => ({
  ...await original<typeof import('./gemini.js')>(),
  getClient: () => ({ models: { generateContent } }),
}));
const { generateExamDraft, skillsFor } = await import('./exam-generator.js');

const reference = new ExamModel(examSeeds[0]).toObject();
const referencePrompt = reference.sections[1]!.questions[0]!.promptText!;

const aiExam = {
  title: 'HSK 1 — Đề AI',
  description: 'Đề luyện',
  sections: [
    { skill: 'listening', title: 'Nghe', instructions: 'Nghe và chọn', questions: [
      { type: 'single_choice', instruction: 'Chọn', promptText: '他去哪儿？', dialogue: [{ speaker: '男', text: '我去学校。' }], options: ['A. 学校', 'B. 医院', 'C. 商店'], correctAnswer: 'A. 学校', explanationVi: '去学校 là đến trường.' },
      { type: 'true_false', instruction: 'Đúng sai', promptText: '他不去学校。', correctAnswer: '对', explanationVi: 'Thiếu lời thoại nên bị loại.' },
      { type: 'true_false', instruction: 'Đúng sai', promptText: '她喜欢喝茶。', dialogue: [{ speaker: '女', text: '我很喜欢喝茶。' }], correctAnswer: '对', explanationVi: '很喜欢 là rất thích.' },
    ] },
    { skill: 'reading', title: 'Đọc', instructions: 'Đọc và chọn', questions: [
      { type: 'single_choice', instruction: 'Chọn', promptText: referencePrompt, options: ['两个', '三个'], correctAnswer: 'B', explanationVi: 'Trùng đề mẫu.' },
      { type: 'sentence_ordering', instruction: 'Sắp xếp', sentenceChunks: ['我', '学生', '是'], correctAnswer: '我是学生', explanationVi: 'Viết không dùng cho phần đọc.' },
      { type: 'fill_in_blank', instruction: 'Điền từ', promptText: '我____中国人。', options: ['是', '有', '在', '去'], correctAnswer: '是', explanationVi: '是 là "là".' },
    ] },
  ],
};

beforeEach(() => {
  vi.spyOn(ExamModel, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [reference] }) }) } as never);
  vi.spyOn(ExamModel, 'exists').mockResolvedValue(null as never);
  generateContent.mockReset();
  generateContent.mockResolvedValue({ text: JSON.stringify(aiExam) });
});
afterEach(() => vi.restoreAllMocks());

describe('generateExamDraft', () => {
  it('sends same-level references and returns a validated, unpublished draft', async () => {
    const result = await generateExamDraft({ level: 1, category: 'mini_test', questionsPerSection: 2 });
    expect(ExamModel.find).toHaveBeenCalledWith({ level: { $gte: 0, $lte: 2 } });
    const prompt = generateContent.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('HSK 1');
    expect(prompt).toContain(referencePrompt);

    const { exam } = result;
    expect(exam).toMatchObject({ level: 1, category: 'mini_test', isPublished: false, totalQuestions: 3, totalScore: 200, passingScore: 120 });
    expect(exam.code).toMatch(/^AI-H1-\d{6}-01$/);
    const [listening, reading] = exam.sections;
    expect(listening!.questions[0]).toMatchObject({ options: ['学校', '医院', '商店'], correctAnswer: 'A', order: 1 });
    expect(listening!.questions[0]!.dialogue![0]!.pinyin).toBeTruthy();
    expect(listening!.questions[0]!.pinyinScript).toBeTruthy();
    expect(listening!.questions[1]).toMatchObject({ type: 'true_false', correctAnswer: 'True' });
    expect(reading!.questions.map(q => q.type)).toEqual(['fill_in_blank']);
    expect(reading!.questions[0]!.pinyinScript).toContain('____');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('thiếu lời thoại'),
      expect.stringContaining('trùng với đề tham khảo'),
      expect.stringContaining('1/2'),
    ]));
    expect(result.references).toEqual([{ id: String(reference._id), code: 'H11001', title: reference.title, level: 1 }]);
  });

  it('strips answer-revealing glosses and drops non-Chinese prompts', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Đề', sections: [
      { skill: 'listening', title: 'Nghe', instructions: 'Nghe', questions: [
        { type: 'true_false', instruction: 'Đúng sai', promptText: 'Nhận định: người nam không muốn đi.', dialogue: [{ speaker: '男', text: '好啊。' }], correctAnswer: 'False', explanationVi: 'x' },
        { type: 'single_choice', instruction: 'Chọn', promptText: '天气怎么样？ (Thời tiết thế nào?)', dialogue: [{ speaker: '女', text: '今天很热。' }], options: ['很热 (Rất nóng)', '很冷 (Rất lạnh)'], correctAnswer: 'A', explanationVi: 'x' },
      ] },
      { skill: 'reading', title: 'Đọc', instructions: 'Đọc', questions: [
        { type: 'fill_in_blank', instruction: 'Xác định đúng hoặc sai.', promptText: '请把杯子____过来。', options: ['拿 (ná)', '听 (tīng)'], correctAnswer: '拿 (ná)', explanationVi: 'x' },
      ] },
    ] }) });
    const { exam, warnings } = await generateExamDraft({ level: 3, category: 'mini_test', skills: ['listening', 'reading'], questionsPerSection: 2 });
    expect(exam.sections[0]!.questions).toHaveLength(1);
    expect(exam.sections[0]!.questions[0]).toMatchObject({ promptText: '天气怎么样？', options: ['很热', '很冷'], correctAnswer: 'A' });
    expect(exam.sections[1]!.questions[0]).toMatchObject({ options: ['拿', '听'], correctAnswer: '拿', instruction: 'Điền từ thích hợp vào chỗ trống.' });
    expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('không phải tiếng Trung')]));
  });

  it('flags answers the blind cross-check disagrees with', async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify(aiExam) })
      .mockImplementationOnce(async ({ contents }: { contents: string }) => {
        const blind = JSON.parse(contents.split('\n').at(-1)!) as Array<{ id: string; correctAnswer?: string }>;
        expect(JSON.stringify(blind)).not.toContain('correctAnswer');
        return { text: JSON.stringify({ answers: [{ id: blind[0]!.id, answer: 'B' }, { id: blind[1]!.id, answer: 'True' }] }) };
      });
    const { warnings } = await generateExamDraft({ level: 1, category: 'mini_test', questionsPerSection: 2 });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1]![0].config.temperature).toBe(0);
    const flagged = warnings.filter(w => w.includes('cần xem lại đáp án'));
    expect(flagged).toEqual([expect.stringContaining('Câu 1: AI kiểm tra lại chọn "B" thay vì "A"')]);
  });

  it('uses explicitly chosen reference exams', async () => {
    const id = String(reference._id);
    await generateExamDraft({ level: 1, category: 'mini_test', questionsPerSection: 2, referenceExamIds: [id] });
    expect(vi.mocked(ExamModel.find).mock.calls[0]![0]).toMatchObject({ _id: { $in: [reference._id] } });
  });

  it('rejects malformed model output', async () => {
    generateContent.mockResolvedValue({ text: '{"title":"x"}' });
    await expect(generateExamDraft({ level: 1, category: 'mini_test', questionsPerSection: 2 })).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });
});

describe('skillsFor', () => {
  it('derives sections from level and category', () => {
    expect(skillsFor({ level: 2, category: 'full_mock' })).toEqual(['listening', 'reading']);
    expect(skillsFor({ level: 4, category: 'full_mock' })).toEqual(['listening', 'reading', 'writing']);
    expect(skillsFor({ level: 4, category: 'skill_writing' })).toEqual(['writing']);
    expect(skillsFor({ level: 3, category: 'mini_test', skills: ['reading', 'writing'] })).toEqual(['reading', 'writing']);
    expect(() => skillsFor({ level: 2, category: 'skill_writing' })).toThrow();
  });
});
