import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Single source of truth via env so a model retirement (gemini-2.5-flash was
// decommissioned on 2026-09-19 in favour of gemini-3.5-flash-lite) only
// requires updating env.ts instead of every hardcoded site.
const IMPROVEMENT_MODEL_HINT = env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

export interface CueInput {
  cueId: string;
  zh: string;
  vi: string; // Azure output we want to improve.
}

export interface CueOutput {
  cueId: string;
  vi: string;
}

const SYSTEM_PROMPT = `Bạn là biên tập viên tiếng Việt cho một ứng dụng học tiếng Trung.
Nhiệm vụ: viết lại các câu tiếng Việt sao cho TỰ NHIÊN, MƯỢT MÀ, đúng ngữ pháp Việt,
và truyền tải đúng nghĩa gốc của câu tiếng Trung.

Nguyên tắc bắt buộc (giữ để xử lý nhất quán):
1. NGUYÊN văn tiếng Trung là chuẩn — KHÔNG được thêm/sửa nghĩa, KHÔNG được nói khác ý.
2. Cấu trúc "X, Y" trong tiếng Trung (ví dụ 弟弟 = em trai, 哥哥 = anh trai) phải dịch chính xác
   theo vai vế — đừng để Azure dịch "em trai" thành "anh trai".
3. Câu tiếng Việt phải đọc như người Việt nói hàng ngày. Tự nhiên, không máy móc.
4. Ưu tiên đúng nghĩa tiếng Trung và lời thoại tự nhiên; bản Azure chỉ là tham khảo có thể sai. Không dài dòng.
5. Mỗi cue trả về ĐÚNG một dòng, không bullet, không số thứ tự, không ký tự đặc biệt.
6. Dịch lại từ tiếng Trung rồi đối chiếu bản Azure. Kiểm tra vai vế (弟弟 = em trai), đại từ và tên nhân vật nhất quán giữa các câu. Với Peppa Pig: 佩奇 = Peppa, 乔治 = George; lời trẻ nhỏ dùng “mình/con”, tránh “ta”.
7. Ký tự "..." hay chỗ trống không rõ nghĩa → giữ nguyên dấu "..." để tránh bịa.

Trả về JSON object: { "items": [{ "cueId": "...", "vi": "..." }, ...] }
Giữ cueId y nguyên từ input. KHÔNG thêm field nào khác. KHÔNG Markdown.`;

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Build the user message for a single batch.
 * Keep wording tight to minimise input tokens (cost).
 */
function buildUserPrompt(batch: readonly CueInput[]): string {
  const lines = batch.map(
    (cue, i) => `${i + 1}. [${cue.cueId}] zh=${JSON.stringify(cue.zh)} | azvi=${JSON.stringify(cue.vi)}`,
  );
  return `Rewrite the "azvi" version into natural Vietnamese idiomatic prose.\n\n${lines.join('\n')}`;
}

/**
 * Parse Gemini's text response into structured cue updates.
 *
 * Robust against: missing code fences, leading prose, occasional bad lines.
 */
function parseImprovementResponse(text: string): CueOutput[] | null {
  const trimmed = text.trim();
  // Strip ```json fences if Gemini adds them anyway.
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
    : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    logger.warn(
      { err: String(err), length: jsonText.length },
      '[translation-improver] invalid JSON',
    );
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) {
    logger.warn(
      { length: jsonText.length },
      '[translation-improver] unexpected JSON shape',
    );
    return null;
  }
  const items = (parsed as { items: unknown[] }).items;
  const out: CueOutput[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { cueId?: unknown; vi?: unknown };
    if (typeof obj.cueId !== 'string' || typeof obj.vi !== 'string') continue;
    const vi = obj.vi.trim();
    if (vi.length === 0 || vi.length > 600) continue;
    out.push({ cueId: obj.cueId, vi });
  }
  return out;
}

/**
 * Improve a batch of Vietnamese translations using Gemini.
 *
 * Cost shape (Gemini 2.5 Flash):
 *   - Input: ~500 system + ~47 tokens / cue
 *   - Output: ~22 tokens / cue (natural Vietnamese is shorter than Azure's literal)
 *   - For 25 cues: ~1,700 input + ~550 output tokens ≈ $0.0019 per batch
 *   - For 110 cues → 5 batches ≈ $0.0095/video
 */
export async function improveVietnameseBatch(
  batch: readonly CueInput[],
  attempt = 0,
): Promise<CueOutput[]> {
  if (batch.length === 0) return [];
  if (!env.GEMINI_TRANSLATION_IMPROVE_ENABLED || !env.GEMINI_API_KEY) {
    return batch.map((c) => ({ cueId: c.cueId, vi: c.vi }));
  }

  try {
    const response = await client.models.generateContent({
      model: IMPROVEMENT_MODEL_HINT,
      contents: buildUserPrompt(batch),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        // JSON includes UUIDs and Vietnamese text, not just ~30 tokens/cue.
        maxOutputTokens: Math.max(2048, batch.length * 180 + 1024),
        httpOptions: { timeout: env.GEMINI_TIMEOUT_MS * 2 },
        responseMimeType: 'application/json',
      },
    });
    const text = response.text ?? '';
    const parsed = parseImprovementResponse(text);
    if (!parsed || parsed.length === 0) {
      if (attempt < 2) return improveVietnameseBatch(batch, attempt + 1);
      // Empty / malformed response: keep Azure output so the pipeline never breaks.
      return batch.map((c) => ({ cueId: c.cueId, vi: c.vi }));
    }
    // Fill in any cues Gemini skipped (returned empty/oversized string) with
    // the Azure output. Defensive — earlier loop drops malformed items.
    const byId = new Map(parsed.map(item => [item.cueId, item.vi]));
    const missing = batch.filter(c => !byId.has(c.cueId));
    if (missing.length && attempt < 2) {
      for (const item of await improveVietnameseBatch(missing, attempt + 1)) byId.set(item.cueId, item.vi);
    }
    return batch.map(c => ({
      cueId: c.cueId,
      vi: byId.get(c.cueId) ?? c.vi,
    }));
  } catch (err) {
    logger.warn({ err: String(err) }, '[translation-improver] Gemini failed, falling back to Azure output');
    return batch.map((c) => ({ cueId: c.cueId, vi: c.vi }));
  }
}

/**
 * Chunk input cues into batches and rewrite each one.
 * Always falls back to Azure output if Gemini fails / is disabled,
 * so the pipeline never breaks.
 */
export async function improveVietnameseTranslations(
  cues: readonly CueInput[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (cues.length === 0) return out;

  // Seed with Azure output so fallback is always available.
  for (const c of cues) out.set(c.cueId, c.vi);

  if (!env.GEMINI_TRANSLATION_IMPROVE_ENABLED || !env.GEMINI_API_KEY) {
    return out;
  }

  const size = env.GEMINI_TRANSLATION_BATCH_SIZE;
  let processed = 0;

  for (let i = 0; i < cues.length; i += size) {
    const batch = cues.slice(i, i + size);
    const updated = await improveVietnameseBatch(batch);
    for (const item of updated) {
      out.set(item.cueId, item.vi);
    }
    processed += batch.length;
    logger.info(
      { processed, total: cues.length, batchSize: batch.length, applied: updated.length },
      '[translation-improver] batch processed',
    );
  }

  return out;
}
