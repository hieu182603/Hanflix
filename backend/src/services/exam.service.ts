import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { ExamModel, type Exam } from '../models/exam.model.js';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';
import { type ExamInput, type GradedQuestion, importExamSchema } from './exam-validation.js';

export function examMetadata(exam: Omit<Exam, 'sections'> & { _id: Types.ObjectId }) {
  return {
    id: String(exam._id), code: exam.code, title: exam.title, level: exam.level,
    category: exam.category, durationMinutes: exam.durationMinutes,
    totalQuestions: exam.totalQuestions, totalScore: exam.totalScore,
    passingScore: exam.passingScore, description: exam.description, attemptCount: exam.attemptCount,
  };
}

// Explicit allowlist also protects responses if a future query selects hidden fields.
export function publicExam(exam: Exam & { _id: Types.ObjectId }) {
  return {
    ...examMetadata(exam),
    sections: exam.sections.map(section => ({
      skill: section.skill, title: section.title, totalQuestions: section.totalQuestions,
      durationMinutes: section.durationMinutes, audioUrl: section.audioUrl, instructions: section.instructions,
      questions: section.questions.map(q => ({
        id: q.id, order: q.order, type: q.type, skill: q.skill, part: q.part,
        instruction: q.instruction, promptText: q.promptText, dialogue: q.dialogue,
        audioUrl: q.audioUrl, imageUrl: q.imageUrl, options: q.options ?? (q.type === 'true_false' ? ['True', 'False'] : undefined), sentenceChunks: q.sentenceChunks,
        // Higher-level scripts may spell out a missing word or the ordered sentence.
        ...(exam.level <= 2 ? { pinyinScript: q.pinyinScript } : {}),
      })),
    })),
  };
}

export function isCorrectAnswer(q: GradedQuestion, answer: string): boolean {
  const value = answer.normalize('NFKC').trim();
  const target = q.correctAnswer.normalize('NFKC').trim();
  if (!value) return false;
  if (q.type === 'sentence_ordering') {
    return [q.correctAnswer, ...(q.acceptedAnswers ?? [])].some(answer =>
      value.replace(/\s/gu, '') === answer.normalize('NFKC').replace(/\s/gu, ''));
  }
  if (q.type === 'single_choice' || (q.type === 'fill_in_blank' && q.options?.length)) {
    const options = q.options ?? [];
    const indexOf = (input: string) => {
      const exact = options.findIndex(option => option.normalize('NFKC').trim() === input);
      if (exact >= 0) return exact;
      return /^[A-T]$/.test(input) && input.charCodeAt(0) - 65 < options.length ? input.charCodeAt(0) - 65 : -1;
    };
    const expected = indexOf(target);
    return expected >= 0 && indexOf(value) === expected;
  }
  return value === target;
}

export function gradeExam(exam: ExamInput, answers: Record<string, string>) {
  const questions = exam.sections.flatMap(section => section.questions);
  const ids = new Set(questions.map(q => q.id));
  if (Object.keys(answers).some(id => !ids.has(id))) throw new AppError(422, 'UNKNOWN_QUESTION', 'Bài làm chứa câu hỏi không thuộc đề thi');
  const questionResults = questions.map(question => ({
    question, userAns: answers[question.id] ?? '', isCorrect: isCorrectAnswer(question, answers[question.id] ?? ''),
  }));
  const skillScore = (skill: GradedQuestion['skill']) => {
    const items = questionResults.filter(item => item.question.skill === skill);
    return items.length ? Math.round(100 * items.filter(item => item.isCorrect).length / items.length) : 0;
  };
  const listeningScore = skillScore('listening');
  const readingScore = skillScore('reading');
  const writingScore = skillScore('writing');
  const score = listeningScore + readingScore + writingScore;
  return { listeningScore, readingScore, writingScore, score, isPassed: score >= exam.passingScore, questionResults };
}

export function examFilter(id: string) {
  return { ...(Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : { code: id }), isPublished: true };
}

export async function importExams(exams: ExamInput[]) {
  if (new Set(exams.map(exam => exam.code)).size !== exams.length) throw new AppError(422, 'DUPLICATE_CODE', 'Mã đề bị trùng trong dữ liệu import');
  await ExamModel.init();
  for (const exam of exams) {
    await ExamModel.updateOne({ code: exam.code }, { $set: exam, $setOnInsert: { attemptCount: 0 } }, { upsert: true, runValidators: true });
  }
  return { imported: exams.length, codes: exams.map(exam => exam.code) };
}

export async function submitExam(id: string, userId: Types.ObjectId, answers: Record<string, string>, timeSpentSeconds: number, submissionKey: string) {
  const exam = await ExamModel.findOne(examFilter(id)).select(
    '+sections.questions.correctAnswer +sections.questions.acceptedAnswers +sections.questions.explanationVi +sections.questions.translationVi +sections.questions.grammarPoint +sections.questions.recommendedLessonTitle +sections.questions.recommendedLessonId',
  ).lean();
  if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  const previous = await ExamAttemptModel.findOne({ userId, submissionKey }).select('+resultJson').lean();
  if (previous && String(previous.examId) !== String(exam._id)) throw new AppError(409, 'SUBMISSION_CONFLICT', 'Mã nộp bài đã dùng cho đề khác');
  if (!previous) {
    const validated = importExamSchema.parse(exam);
    const grading = gradeExam(validated, answers);
    const submittedAt = new Date();
    const attemptId = new Types.ObjectId();
    const result = {
      ...grading, id: String(attemptId), exam: { ...examMetadata(exam), sections: validated.sections },
      answers, timeSpentSeconds, totalScore: exam.totalScore, passingScore: exam.passingScore, submittedAt: submittedAt.toISOString(),
    };
    try {
      await ExamAttemptModel.create({
        _id: attemptId, userId, examId: exam._id, examCode: exam.code, level: exam.level,
        answers, timeSpentSeconds, ...grading, totalScore: exam.totalScore, passingScore: exam.passingScore,
        submittedAt, submissionKey, resultJson: JSON.stringify(result),
      });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 11000)) throw error;
      // Concurrent retry: the unique (user, submissionKey) index chooses one result.
    }
  }
  const saved = previous ?? await ExamAttemptModel.findOne({ userId, submissionKey }).select('+resultJson').lean();
  if (!saved || String(saved.examId) !== String(exam._id)) throw new AppError(409, 'SUBMISSION_CONFLICT', 'Không thể xác nhận lần nộp bài');
  // Reconcile after persistence; retries repair a failed counter update without duplicating attempts.
  // Works with standalone MongoDB too, without requiring replica-set transactions.
  const count = await ExamAttemptModel.countDocuments({ examId: exam._id });
  await ExamModel.updateOne({ _id: exam._id }, { $max: { attemptCount: count } });
  const result: unknown = JSON.parse(saved.resultJson);
  return result;
}
