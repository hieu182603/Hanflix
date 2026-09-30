import { describe, expect, it } from 'vitest';
import { ExamModel } from '../models/exam.model.js';
import { examSeeds } from '../data/exam-seeds.js';
import { gradeExam, isCorrectAnswer, publicExam } from './exam.service.js';
import { importExamSchema, submitExamSchema } from './exam-validation.js';

describe('HSK validation and server grading', () => {
  it.each(examSeeds)('grades every answer in $code against the server bank', exam => {
    const questions = exam.sections.flatMap(section => section.questions);
    const correct = Object.fromEntries(questions.map(q => [q.id, q.correctAnswer]));
    expect(gradeExam(exam, correct)).toMatchObject({ score: exam.totalScore, isPassed: true });
    expect(gradeExam(exam, {})).toMatchObject({ score: 0, isPassed: false });
    expect(questions.length).toBe(exam.totalQuestions);
  });
  it('weights skills equally instead of questions and rounds each skill', () => {
    const exam = examSeeds.find(item => item.level === 3)!;
    const section = exam.sections[0]!;
    const answers = Object.fromEntries(section.questions.map(q => [q.id, q.correctAnswer]));
    expect(gradeExam(exam, answers)).toMatchObject({ listeningScore: 100, readingScore: 0, writingScore: 0, score: 100 });
    expect(gradeExam(exam, { [section.questions[0]!.id]: section.questions[0]!.correctAnswer }).score).toBe(20);
  });
  it('accepts a choice letter or complete option but rejects prefix/substring guessing', () => {
    const q = examSeeds[0]!.sections[0]!.questions[0]!;
    expect(isCorrectAnswer(q, 'A')).toBe(true);
    expect(isCorrectAnswer(q, q.options![0]!)).toBe(true);
    expect(isCorrectAnswer(q, 'A B C D')).toBe(false);
    expect(isCorrectAnswer(q, `anything ${q.correctAnswer}`)).toBe(false);
    expect(isCorrectAnswer(q, '')).toBe(false);
  });
  it('handles ordering whitespace and exact free-text/true-false answers', () => {
    const q = examSeeds[2]!.sections[2]!.questions[0]!;
    expect(isCorrectAnswer(q, [...q.correctAnswer].join(' '))).toBe(true);
    expect(isCorrectAnswer(q, q.correctAnswer + '错')).toBe(false);
    expect(isCorrectAnswer({ ...q, type: 'fill_in_blank', correctAnswer: '学习' }, '学习')).toBe(true);
    expect(isCorrectAnswer({ ...q, type: 'fill_in_blank', correctAnswer: '学习' }, '学')).toBe(false);
    const tf = examSeeds[0]!.sections[0]!.questions[1]!;
    expect(isCorrectAnswer(tf, 'False')).toBe(true);
    expect(isCorrectAnswer(tf, 'True')).toBe(false);
  });
  it('accepts reviewed sentence alternatives without guessing and keeps them out of public payloads', () => {
    const sample = structuredClone(examSeeds[2]!);
    const q = sample.sections[2]!.questions[0]!;
    Object.assign(q, { type: 'sentence_ordering', sentenceChunks: ['姐姐', '汉语说得', '我', '比', '流利'],
      correctAnswer: '姐姐比我汉语说得流利', acceptedAnswers: ['姐姐汉语说得比我流利'] });
    expect(importExamSchema.safeParse(sample).success).toBe(true);
    expect(isCorrectAnswer(q, '姐姐 汉语说得 比 我 流利')).toBe(true);
    expect(isCorrectAnswer(q, '姐姐 比 我 汉语说得 流利')).toBe(true);
    expect(isCorrectAnswer(q, '我比姐姐汉语说得流利')).toBe(false);
    const document = new ExamModel(sample).toObject();
    expect(JSON.stringify(publicExam(document))).not.toContain('acceptedAnswers');
    expect(gradeExam(sample, { [q.id]: '姐姐汉语说得比我流利' }).questionResults.find(item => item.question.id === q.id)?.isCorrect).toBe(true);
  });
  it('rejects forged scores, invalid durations and unknown question IDs', () => {
    expect(submitExamSchema.safeParse({ answers: {}, timeSpentSeconds: 1, score: 300 }).success).toBe(false);
    expect(submitExamSchema.safeParse({ answers: {}, timeSpentSeconds: -1 }).success).toBe(false);
    expect(() => gradeExam(examSeeds[0]!, { alien: 'A' })).toThrow('không thuộc đề thi');
  });
  it('rejects empty/duplicate/mismatched import data and strips counters', () => {
    const original = examSeeds[0]!;
    expect(importExamSchema.safeParse({ ...original, sections: [] }).success).toBe(false);
    expect(importExamSchema.safeParse({ ...original, totalQuestions: 200 }).success).toBe(false);
    const duplicate = structuredClone(original);
    duplicate.sections[0]!.questions[1]!.id = duplicate.sections[0]!.questions[0]!.id;
    expect(importExamSchema.safeParse(duplicate).success).toBe(false);
    expect(importExamSchema.parse({ ...original, attemptCount: 999 })).not.toHaveProperty('attemptCount');
  });
  it('redacts answer/review fields even when the database document includes them', () => {
    const document = new ExamModel(examSeeds[2]);
    const response = publicExam(document);
    const serialized = JSON.stringify(response);
    for (const key of ['correctAnswer', 'explanationVi', 'translationVi', 'grammarPoint', 'recommendedLessonId', 'pinyinScript']) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(response.sections[0]!.questions.length).toBe(5);
  });
  it('provides pinyin for all HSK 1–2 prompts, dialogues and choices', () => {
    for (const exam of examSeeds.filter(item => item.level <= 2)) {
      for (const q of exam.sections.flatMap(section => section.questions)) {
        expect(q.pinyinScript).toBeTruthy();
        q.dialogue?.forEach(line => expect(line.pinyin).toBeTruthy());
        q.options?.forEach(option => expect(option).toContain('('));
      }
    }
  });
});
