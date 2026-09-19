import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Single source of truth via env so a model retirement (gemini-2.5-flash was
// decommissioned on 2026-09-19 in favour of gemini-3.5-flash-lite) only
// requires updating env.ts instead of every hardcoded site.
const MODEL = env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

export interface LearningTip {
  /** Short label like "Shadow ngay khi xem". */
  title: string;
  /** Concrete 1-2 sentence instruction the learner can act on. */
  detail: string;
  /** Optional cue id this tip refers to. */
  cueId?: string;
}

export interface LearningTipsResult {
  /** 1-3 short, actionable tips tailored to the lesson. */
  tips: LearningTip[];
  /** Concrete vocabulary the learner should drill after watching. */
  drillWords: string[];
  /** Language used in the tips — Vietnamese by default. */
  language: 'vi';
}

const SYSTEM_PROMPT = `Bạn là một trợ lý học tiếng Trung qua video.
Nhiệm vụ: dựa trên phụ đề tiếng Trung của một video, đề xuất các mẹo học tập
CỤ THỂ, HÀNH ĐỘNG ĐƯỢC, và phù hợp cấp HSK của người học.

Quy tắc:
- Trả về JSON object với 3 trường: tips (1-3 mẹo), drillWords (4-8 từ vựng nên ôn),
  language ("vi").
- tips: mỗi mẹo có title (≤ 20 ký tự) và detail (≤ 140 ký tự).
- Mẹo phải gắn với nội dung video, không chung chung.
- drillWords: chọn từ vựng quan trọng xuất hiện ≥ 2 lần trong phụ đề, sắp theo tần suất giảm.
- Không Markdown, không giải thích. Chỉ JSON.`;

export interface LearningTipsInput {
  lessonTitleVi: string;
  hsk: number;
  cues: ReadonlyArray<{ cueId: string; zh: string; vi: string; pinyin?: string }>;
}

export async function generateLearningTips(
  input: LearningTipsInput,
): Promise<LearningTipsResult> {
  if (!env.GEMINI_API_KEY) {
    return emptyTipsResult();
  }

  const userPrompt = buildUserPrompt(input);
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
      },
    });
    return parseTipsResponse(response.text ?? '', input);
  } catch (err) {
    logger.warn({ err: String(err) }, '[learning-tips] Gemini failed, returning empty tips');
    return emptyTipsResult();
  }
}

function buildUserPrompt(input: LearningTipsInput): string {
  const sample = input.cues
    .slice(0, 30)
    .map((c, i) => `${i + 1}. ${c.zh} (${c.vi})`)
    .join('\n');
  return `Học viên HSK ${input.hsk}. Bài: "${input.lessonTitleVi}".\nPhụ đề (mẫu 30 câu đầu):\n${sample}`;
}

function emptyTipsResult(): LearningTipsResult {
  return { tips: [], drillWords: [], language: 'vi' };
}

function parseTipsResponse(text: string, input: LearningTipsInput): LearningTipsResult {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
    : trimmed;
  try {
    const parsed = JSON.parse(jsonText) as {
      tips?: unknown;
      drillWords?: unknown;
    };
    const tips: LearningTip[] = [];
    if (Array.isArray(parsed.tips)) {
      for (const t of parsed.tips) {
        if (!t || typeof t !== 'object') continue;
        const obj = t as { title?: unknown; detail?: unknown; cueId?: unknown };
        if (typeof obj.title !== 'string' || typeof obj.detail !== 'string') continue;
        const cueId = typeof obj.cueId === 'string' ? obj.cueId : undefined;
        tips.push({
          title: obj.title.trim().slice(0, 60),
          detail: obj.detail.trim().slice(0, 300),
          cueId,
        });
        if (tips.length >= 3) break;
      }
    }
    const drillWords: string[] = [];
    if (Array.isArray(parsed.drillWords)) {
      for (const w of parsed.drillWords) {
        if (typeof w === 'string' && w.trim().length > 0) {
          drillWords.push(w.trim().slice(0, 40));
          if (drillWords.length >= 8) break;
        }
      }
    }
    return { tips, drillWords, language: 'vi' };
  } catch (err) {
    logger.warn({ err: String(err), lessonTitleVi: input.lessonTitleVi }, '[learning-tips] parse failed');
    return emptyTipsResult();
  }
}
