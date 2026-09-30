/**
 * Public exam API types and an answer-free offline catalog.
 * Question banks and grading live exclusively on the backend.
 */

export type ExamSkill = 'listening' | 'reading' | 'writing';

export type QuestionType =
  | 'single_choice'
  | 'true_false'
  | 'sentence_ordering'
  | 'fill_in_blank';

export interface ExamQuestion {
  id: string;
  order: number;
  type: QuestionType;
  skill: ExamSkill;
  part: number; // Phần 1, 2, 3 trong kỹ năng
  instruction: string;
  promptText?: string;
  dialogue?: Array<{ speaker: string; text: string; pinyin?: string }>;
  audioUrl?: string;
  imageUrl?: string;
  options?: string[]; // ['A. ...', 'B. ...', 'C. ...', 'D. ...']
  sentenceChunks?: string[]; // Dành cho dạng sắp xếp câu
  pinyinScript?: string;
  translationVi?: string;
  grammarPoint?: string;
  recommendedLessonTitle?: string;
  recommendedLessonId?: string;
}

export interface ExamSection {
  skill: ExamSkill;
  title: string;
  totalQuestions: number;
  durationMinutes: number;
  audioUrl?: string;
  instructions: string;
  questions: ExamQuestion[];
}

export interface HskExam {
  id: string;
  code: string; // VD: H31001
  title: string;
  level: number; // 1 - 6
  category: 'full_mock' | 'skill_listening' | 'skill_reading' | 'skill_writing' | 'mini_test';
  durationMinutes: number;
  totalQuestions: number;
  totalScore: number;
  passingScore: number;
  description: string;
  attemptCount: number;
  averageScore?: number;
  sections: ExamSection[];
}

export type ExamMetadata = Omit<HskExam, 'sections'>;

export interface ExamReviewQuestion extends ExamQuestion {
  correctAnswer: string;
  explanationVi: string;
}
export interface ExamResult {
  id: string;
  exam: HskExam;
  answers: Record<string, string>;
  questionResults: Array<{ question: ExamReviewQuestion; userAns: string; isCorrect: boolean }>;
  timeSpentSeconds: number;
  score: number;
  listeningScore: number;
  readingScore: number;
  writingScore: number;
  totalScore: number;
  passingScore: number;
  isPassed: boolean;
  submittedAt: string;
}

// Offline catalog only. Starting and grading an exam always require the API.
export const OFFLINE_EXAM_CATALOG: ExamMetadata[] = [1, 2, 3, 4, 5, 6].map(level => ({
  id: `H${level}1001`, code: `H${level}1001`, title: `HSK ${level} — Đề mẫu rút gọn`,
  level, category: 'mini_test', durationMinutes: level === 3 ? 40 : 15,
  totalQuestions: level === 3 ? 15 : level <= 2 ? 4 : 6,
  totalScore: level <= 2 ? 200 : 300, passingScore: level <= 2 ? 120 : 180,
  description: 'Danh mục tham khảo ngoại tuyến. Kết nối máy chủ để tải đề và lưu kết quả.',
  attemptCount: 0,
}));
