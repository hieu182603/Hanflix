import { z } from 'zod';
import { env } from '../config/env.js';
import { GoogleGenAI } from '@google/genai';
import { AppError } from '../errors/app-error.js';
import { logger } from './logger.js';

const generatedQuestionSchema = z.object({
  questionId: z.string().min(1).max(100),
  type: z.enum(['multiple_choice', 'fill_blank']),
  prompt: z.string().min(5).max(1000),
  cueId: z.string().max(100).optional(),
  options: z
    .array(
      z.object({
        optionId: z.string().min(1).max(100),
        text: z.string().min(1).max(500),
      }),
    )
    .max(6)
    .optional()
    .default([]),
  correctOptionId: z.string().max(100).optional(),
  acceptedAnswers: z.array(z.string().min(1).max(500)).max(10).optional(),
  explanationVi: z.string().min(20).max(2000),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

const generationSchema = z.array(generatedQuestionSchema).min(1).max(15);

const DEFAULT_MODEL = env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

let quizClient: GoogleGenAI | undefined;

function getQuizClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, 'GEMINI_NOT_CONFIGURED', 'Gemini API chưa được cấu hình');
  }
  quizClient ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return quizClient;
}

export function selectModelForQuizTask(
  task: 'comprehension' | 'vocabulary' | 'grammar' | 'cloze',
): string {
  // Single source of truth via env so a model retirement (gemini-2.5-flash
  // was decommissioned on 2026-09-19 in favour of gemini-3.5-flash-lite)
  // only requires updating env.ts instead of every hardcoded site.
  const base = env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  switch (task) {
    case 'comprehension':
      return base;
    case 'vocabulary':
      return base;
    case 'grammar':
      return base;
    case 'cloze':
      return base;
  }
}

function sanitizeForPrompt(text: string, maxLength = 500): string {
  return text
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/```/g, '')
    .trim()
    .slice(0, maxLength);
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Gemini trả về dữ liệu không đúng định dạng');
  }
}

export type QuestionKind = 'comprehension' | 'vocabulary' | 'grammar' | 'cloze';

export type QuizGenerationOptions = {
  hsk: number;
  kinds: QuestionKind[];
  questionCount: number;
  cues: Array<{
    cueId: string;
    startMs: number;
    endMs: number;
    zh: string;
    pinyin?: string;
    vi: string;
  }>;
  lessonTitleVi?: string;
  learnerHsk?: number;
};

function buildPrompt(options: QuizGenerationOptions): string {
  const cueLines = options.cues
    .slice(0, 80)
    .map(
      (cue) =>
        `[${cue.cueId} @ ${Math.round(cue.startMs / 1000)}s] zh=${JSON.stringify(cue.zh)} pinyin=${JSON.stringify(cue.pinyin ?? '')} vi=${JSON.stringify(cue.vi)}`,
    )
    .join('\n');

  const sectionsByKind: Record<QuestionKind, string> = {
    comprehension: `Loại COMPREHENSION: tạo ${Math.ceil(options.questionCount / options.kinds.length)} câu trắc nghiệm. prompt phải là CÂU HỎI / ĐOẠN VĂN bằng TIẾNG TRUNG (giữ nguyên chữ Hán, kèm Pinyin trong ngoặc nếu cần). 4 đáp án A,B,C,D phải là CÂU/ĐOẠN TIẾNG VIỆT — học viên đọc tiếng Trung rồi chọn nghĩa tiếng Việt đúng. correctAnswer ∈ {A,B,C,D}. Mỗi câu phải liên kết với cueId cụ thể trong dữ liệu.`,
    vocabulary: `Loại VOCABULARY: tạo ${Math.ceil(options.questionCount / options.kinds.length)} câu trắc nghiệm. prompt phải là TỪ/CỤM TỪ TIẾNG TRUNG (kèm Pinyin trong ngoặc) lấy từ cue (trừ từ chức năng 的/了/是/在/有/和). 4 đáp án A,B,C,D là 4 NGHĨA TIẾNG VIỆT khác nhau của từ đó (1 đúng, 3 nhiễu). correctAnswer ∈ {A,B,C,D}. Mỗi câu phải liên kết với cueId cụ thể.`,
    grammar: `Loại GRAMMAR: tạo ${Math.ceil(options.questionCount / options.kinds.length)} câu trắc nghiệm. prompt là CÂU TIẾNG TRUNG (có thể highlight cấu trúc ngữ pháp trong ngoặc vuông [了/的/得/把/被/是…的/虽然…但是…]). 4 đáp án A,B,C,D là 4 CÂU GIẢI THÍCH TIẾNG VIỆT về ngữ pháp (1 đúng, 3 nhiễu). correctAnswer ∈ {A,B,C,D}. Mỗi câu phải liên kết với cueId cụ thể.`,
    cloze: `Loại FILL_BLANK: tạo ${Math.ceil(options.questionCount / options.kinds.length)} câu điền từ vào chỗ trống. prompt là CÂU TIẾNG TRUNG có một từ bị thay bằng '___'. acceptedAnswers chứa từ đúng (tiếng Trung). Liên kết cueId cụ thể.`,
  };

  const kindsInstructions = options.kinds
    .map((kind) => sectionsByKind[kind])
    .join('\n\n');

  const guidelines = `Yêu cầu chung:
- Trình độ HSK ${options.hsk}, không dùng từ vựng vượt HSK ${options.hsk + 1}.
- Mỗi câu questionId chỉ chứa [a-z0-9-_], unique.
- Loại câu hỏi: 'multiple_choice' (A-D) hoặc 'fill_blank'.
- multiple_choice: đúng 4 đáp án, correctOptionId ∈ {a,b,c,d}, đáp án đúng phải khớp optionId a/b/c/d.
- fill_blank: prompt có '___', acceptedAnswers mảng 1-5 đáp án synonym tiếng Trung.
- explanationVi: giải thích ngắn gọn lý do đúng bằng tiếng Việt (tối thiểu 20 ký tự, có dẫn chứng từ cue).
- cueId phải là cueId thật trong dữ liệu.
- CHỈ trả về JSON, không có text khác ngoài JSON.

Định dạng JSON BẮT BUỘC:
{
  "questions": [
    {
      "questionId": "ai-q-1",
      "type": "multiple_choice",
      "prompt": "他们为什么没有见面？(Tāmen wèishéme méiyǒu jiànmiàn?)",
      "cueId": "cue-abc",
      "options": [
        {"optionId": "a", "text": "Vì họ bận đi làm"},
        {"optionId": "b", "text": "Vì họ đã quen nhau từ trước"},
        {"optionId": "c", "text": "Vì trời mưa to"},
        {"optionId": "d", "text": "Vì họ không có điện thoại"}
      ],
      "correctOptionId": "a",
      "explanationVi": "Theo cue cue-abc, nhân vật nói 'tāmen dōu hěn máng', nên lý do là bận."
    },
    {
      "questionId": "ai-q-2",
      "type": "fill_blank",
      "prompt": "我每天___八点去学校。",
      "cueId": "cue-xyz",
      "acceptedAnswers": ["都"],
      "explanationVi": "都 dùng nhấn mạnh thói quen lặp lại hàng ngày, phù hợp ngữ cảnh cue-xyz."
    }
  ]
}`;

  return [
    'Bạn là giáo viên tiếng Trung chuyên nghiệp, tạo bài tập trắc nghiệm/điền từ cho người Việt.',
    'CHỈ DẪN NGÔN NGỮ CỨNG (không được phá vỡ):',
    '- Với câu hỏi comprehension / vocabulary / grammar: PHẢI viết "prompt" bằng TIẾNG TRUNG (chữ Hán + Pinyin trong ngoặc). Các "options" PHẢI bằng TIẾNG VIỆT.',
    '- Với câu hỏi cloze: prompt và acceptedAnswers phải bằng TIẾNG TRUNG.',
    '- TUYỆT ĐỐI KHÔNG viết prompt bằng tiếng Việt cho comprehension/vocabulary/grammar.',
    '- Mọi explanationVi viết bằng tiếng Việt, có dẫn chứng từ cue.',
    'Chỉ sinh câu hỏi dựa trên cues cung cấp. Không bịa nội dung ngoài transcript.',
    'Không chấm phát âm, không khẳng định trình độ HSK, không nhại voice người dùng.',
    `Bài học: ${sanitizeForPrompt(options.lessonTitleVi ?? '', 200)}`,
    `Trình độ HSK mục tiêu: ${options.hsk}`,
    `Tổng số câu cần sinh (phân chia đều cho các loại): ${options.questionCount}`,
    '',
    'Loại câu hỏi cần sinh:',
    kindsInstructions,
    '',
    guidelines,
    '',
    'Cues (mỗi dòng là 1 cue):',
    cueLines,
  ].join('\n');
}

export async function generateQuizWithGemini(
  options: QuizGenerationOptions,
): Promise<GeneratedQuestion[]> {
  if (options.kinds.length === 0) {
    throw new AppError(422, 'NO_KINDS', 'Cần chọn ít nhất 1 loại câu hỏi');
  }
  if (options.questionCount < 1 || options.questionCount > 15) {
    throw new AppError(422, 'INVALID_COUNT', 'Số câu hỏi phải trong khoảng 1-15');
  }

  const prompt = buildPrompt(options);
  const modelName = options.kinds.length === 1
    ? selectModelForQuizTask(options.kinds[0]!)
    : DEFAULT_MODEL;

  logger.info({ modelName, kinds: options.kinds }, '[quiz-generator] calling Gemini');

  const request = getQuizClient().models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      systemInstruction: 'Bạn là giáo viên tiếng Trung. Mọi câu hỏi comprehension/vocabulary/grammar PHẢI có prompt bằng TIẾNG TRUNG (Hán + Pinyin), đáp án bằng TIẾNG VIỆT. Câu cloze: prompt và acceptedAnswers bằng TIẾNG TRUNG. Chỉ trả JSON hợp lệ.',
    },
  });

  let timerId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new AppError(504, 'AI_TIMEOUT', 'Gemini phản hồi quá thời gian')),
      env.GEMINI_TIMEOUT_MS * 2,
    );
  });

  try {
    const response = await Promise.race([request, timeout]);
    const cleaned = extractJson(response.text ?? '');
    let parsedArray: unknown[];
    if (Array.isArray(cleaned)) {
      parsedArray = cleaned as unknown[];
    } else if (cleaned && typeof cleaned === 'object' && Array.isArray((cleaned as { questions?: unknown[] }).questions)) {
      parsedArray = (cleaned as { questions: unknown[] }).questions;
    } else {
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'Gemini trả về dữ liệu không phải mảng câu hỏi');
    }

    let validCount = 0;
    let invalidCount = 0;
    const verified: GeneratedQuestion[] = [];
    for (const raw of parsedArray) {
      const result = generatedQuestionSchema.safeParse(raw);
      if (!result.success) {
        invalidCount++;
        continue;
      }
      validCount++;
      verified.push(result.data);
    }
    if (invalidCount > 0) {
      logger.warn({ validCount, invalidCount }, '[quiz-generator] dropped some invalid questions from Gemini response');
    }

    const validCueIds = new Set(options.cues.map((c) => c.cueId));
    return verified
      .map((question) => {
        if (question.cueId && !validCueIds.has(question.cueId)) {
          return { ...question, cueId: undefined };
        }
        return question;
      })
      .filter((question) => {
        if (question.type === 'multiple_choice') {
          return (
            question.options.length >= 2 &&
            Boolean(question.correctOptionId) &&
            question.options.some((o) => o.optionId === question.correctOptionId)
          );
        }
        return Boolean(question.acceptedAnswers && question.acceptedAnswers.length > 0);
      });
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}
