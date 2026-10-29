import { z } from 'zod';
import { examCategories, examSkills, questionTypes } from '../models/exam.model.js';

const text = z.string().max(20000);
const mediaUrl = z.url().refine(value => /^https?:\/\//.test(value), 'Only HTTP(S) media URLs are supported');
export const questionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value)),
  order: z.number().int().positive(), type: z.enum(questionTypes), skill: z.enum(examSkills),
  part: z.number().int().positive(), instruction: text.min(1), promptText: text.optional(),
  dialogue: z.array(z.object({ speaker: text, text: text, pinyin: text.optional() })).max(100).optional(),
  audioUrl: mediaUrl.optional(), imageUrl: mediaUrl.optional(),
  options: z.array(text.min(1)).min(2).max(20).optional(),
  sentenceChunks: z.array(text.min(1)).min(2).max(100).optional(),
  correctAnswer: text.trim().min(1), explanationVi: text.min(1),
  acceptedAnswers: z.array(text.trim().min(1)).max(20).optional(),
  pinyinScript: text.optional(), translationVi: text.optional(), grammarPoint: text.optional(),
  recommendedLessonTitle: text.optional(), recommendedLessonId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).superRefine((q, ctx) => {
  if (q.acceptedAnswers?.length && q.type !== 'sentence_ordering') {
    ctx.addIssue({ code: 'custom', message: 'Alternative answers are only supported for sentence ordering' });
  }
  if ((q.type === 'single_choice' || (q.type === 'fill_in_blank' && q.options)) && (!q.options || !q.options.some((option, index) =>
    option === q.correctAnswer || String.fromCharCode(65 + index) === q.correctAnswer))) {
    ctx.addIssue({ code: 'custom', message: 'Choice answer must be an option or its letter' });
  }
  if (q.type === 'true_false' && !(q.options?.length === 2 ? q.options.includes(q.correctAnswer) : ['True', 'False'].includes(q.correctAnswer))) {
    ctx.addIssue({ code: 'custom', message: 'True/False answer required' });
  }
  if (q.type === 'sentence_ordering' && !q.sentenceChunks?.length) {
    ctx.addIssue({ code: 'custom', message: 'Sentence chunks required' });
  }
  if (q.options && new Set(q.options).size !== q.options.length) {
    ctx.addIssue({ code: 'custom', message: 'Options must be unique' });
  }
});

export const importExamSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{1,80}$/), title: z.string().trim().min(1).max(500),
  level: z.number().int().min(1).max(9), category: z.enum(examCategories),
  durationMinutes: z.number().int().min(1).max(300), totalQuestions: z.number().int().min(1).max(500),
  totalScore: z.number().int().positive(), passingScore: z.number().int().nonnegative(),
  description: text.default(''), isPublished: z.boolean().default(true),
  sections: z.array(z.object({
    skill: z.enum(examSkills), title: text.min(1), totalQuestions: z.number().int().positive(),
    durationMinutes: z.number().int().positive(), audioUrl: mediaUrl.optional(), instructions: text.min(1),
    questions: z.array(questionSchema).min(1).max(500),
  })).min(1).max(3),
}).superRefine((exam, ctx) => {
  const questions = exam.sections.flatMap(section => section.questions);
  const skills = new Set(exam.sections.map(section => section.skill));
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (questions.length !== exam.totalQuestions) issue('totalQuestions does not match questions');
  if (new Set(questions.map(q => q.id)).size !== questions.length) issue('Question IDs must be unique');
  if (new Set(questions.map(q => q.order)).size !== questions.length) issue('Question orders must be unique');
  if (skills.size !== exam.sections.length) issue('Each skill must have one section');
  if (exam.totalScore !== skills.size * 100 || exam.passingScore > exam.totalScore) issue('Each skill is scored out of 100');
  if (exam.category === 'full_mock' && (skills.size !== (exam.level <= 2 ? 2 : 3) || !skills.has('listening') || !skills.has('reading'))) issue('Full mock requires all level skills');
  if (exam.category === 'full_mock' && exam.passingScore !== (exam.level <= 2 ? 120 : 180)) issue('Full mock passing score must match the HSK level');
  if (exam.level <= 2 && skills.has('writing')) issue('HSK 1–2 do not have writing');
  if (exam.category.startsWith('skill_') && (skills.size !== 1 || `skill_${exam.sections[0]?.skill}` !== exam.category)) issue('Skill category must match the section');
  for (const section of exam.sections) {
    if (section.totalQuestions !== section.questions.length || section.questions.some(q => q.skill !== section.skill)) issue('Section count/skill mismatch');
  }
});
export type ExamInput = z.infer<typeof importExamSchema>;
export type GradedQuestion = z.infer<typeof questionSchema>;
export const importExamsSchema = z.union([importExamSchema, z.array(importExamSchema).min(1).max(50)]);
export const submitExamSchema = z.object({
  answers: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), z.string().max(20000))
    .refine(value => Object.keys(value).length <= 500, 'Too many answers'),
  timeSpentSeconds: z.number().int().min(0).max(86400),
}).strict();
