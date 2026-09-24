/**
 * CONTENT MODE (2026-09-22) - SONG: LRC parser service.
 *
 * Mục đích:
 *   - Parse file LRC (Lyrics) chuẩn `[mm:ss.xx]text`.
 *   - Parse plain text fallback khi admin không có timestamp.
 *   - Parse metadata `[ti:...]`, `[ar:...]`, `[al:...]` để fill song info.
 *
 * LRC format chuẩn:
 *   [ti:Tiêu đề bài hát]
 *   [ar:Ca sĩ]
 *   [al:Album]
 *   [00:12.34]Câu lyrics đầu tiên
 *   [00:15.67]Câu lyrics thứ hai
 *   [00:18.90]Câu thứ ba
 *
 * Multi-timestamp (một dòng có nhiều tag thời gian):
 *   [00:12.34][01:23.45]Lặp lại câu này
 *
 * Đầu ra LyricsCue[]:
 *   - startMs: thời điểm bắt đầu (ms)
 *   - endMs:   thời điểm kết thúc = startMs của cue tiếp theo (ms); cue cuối = +5000ms
 *   - text:    nội dung Hán tự
 *
 * Đặc tính:
 *   - Idempotent: parse cùng input nhiều lần cho cùng output.
 *   - Robust: bỏ qua dòng lỗi thay vì throw — admin có thể fix thủ công.
 *   - Không gọi external service → dùng được cả khi offline.
 */

export interface LyricsCue {
  startMs: number;
  endMs: number;
  text: string;
}

export interface ParsedLrc {
  title?: string;
  artist?: string;
  album?: string;
  cues: LyricsCue[];
  /**
   * True nếu input có ít nhất một dòng timestamp hợp lệ.
   * False nếu chỉ toàn metadata hoặc plain text.
   */
  hasTimestamps: boolean;
}

/**
 * Parse một timestamp LRC `[mm:ss.xx]` hoặc `[mm:ss.xxx]` thành milliseconds.
 * Trả về null nếu format sai.
 */
function parseLrcTimestamp(token: string): number | null {
  // token dạng "mm:ss.xx" hoặc "mm:ss.xxx"
  const match = /^(\d+):(\d{1,2})(?:[.:](\d{1,3}))?$/.exec(token.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fractionRaw = match[3] ?? '0';
  // LRC fraction là 2 chữ số (centiseconds) hoặc 3 chữ số (milliseconds).
  const fraction = Number(fractionRaw.padEnd(3, '0').slice(0, 3));
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(fraction)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
  return minutes * 60_000 + seconds * 1000 + fraction;
}

/**
 * Trích một dòng LRC: trả về danh sách timestamp (ms) và phần text còn lại.
 * Ví dụ: "[00:12.34][01:23.45]Xin chào" → timestamps=[12340, 83450], text="Xin chào"
 */
function extractLrcLine(line: string): { timestamps: number[]; text: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const timestamps: number[] = [];
  let cursor = 0;
  // Lặp qua tất cả tag timestamp ở đầu dòng
  while (cursor < trimmed.length && trimmed[cursor] === '[') {
    const closingIndex = trimmed.indexOf(']', cursor);
    if (closingIndex === -1) break;
    const token = trimmed.slice(cursor + 1, closingIndex);
    const parsed = parseLrcTimestamp(token);
    if (parsed === null) {
      // Không phải timestamp — có thể là metadata [ti:...]. Trả về null để caller xử lý riêng.
      break;
    }
    timestamps.push(parsed);
    cursor = closingIndex + 1;
  }
  const text = trimmed.slice(cursor).trim();
  // Bỏ qua dòng rỗng hoặc dòng chỉ có metadata
  if (timestamps.length === 0 || !text) {
    return null;
  }
  return { timestamps, text };
}

/**
 * Parse metadata line: [ti:Title], [ar:Artist], [al:Album], [by:LRC maker], [length:...]
 */
function parseMetadata(line: string): { key: string; value: string } | null {
  const match = /^\[([a-zA-Z]+):(.+?)\]\s*$/.exec(line.trim());
  if (!match) return null;
  return { key: (match[1] ?? '').toLowerCase(), value: (match[2] ?? '').trim() };
}

/**
 * Parse nội dung LRC đầy đủ.
 * Trả về cues đã sort theo startMs + metadata nếu có.
 */
export function parseLRC(content: string): ParsedLrc {
  const lines = content.split(/\r?\n/);
  const rawCues: LyricsCue[] = [];
  let title: string | undefined;
  let artist: string | undefined;
  let album: string | undefined;
  let hasTimestamps = false;
  let offsetMs = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Metadata line
    const meta = parseMetadata(trimmed);
    if (meta) {
      if (meta.key === 'offset' && Number.isFinite(Number(meta.value))) offsetMs = Number(meta.value);
      if (meta.key === 'ti' && !title) title = meta.value;
      else if (meta.key === 'ar' && !artist) artist = meta.value;
      else if (meta.key === 'al' && !album) album = meta.value;
      continue;
    }

    // Timestamp line
    const extracted = extractLrcLine(trimmed);
    if (!extracted) continue;
    hasTimestamps = true;

    for (const startMs of extracted.timestamps) {
      rawCues.push({ startMs, endMs: 0, text: extracted.text });
    }
  }

  const grouped = new Map<number, string[]>();
  for (const cue of rawCues) {
    const start = Math.max(0, cue.startMs + offsetMs);
    grouped.set(start, [...(grouped.get(start) ?? []), cue.text]);
  }
  const sorted = [...grouped].sort(([a], [b]) => a - b);
  const cues = sorted.map(([startMs, texts], i) => ({
    startMs, endMs: sorted[i + 1]?.[0] ?? startMs + 5000, text: [...new Set(texts)].join(' '),
  }));

  return { title, artist, album, cues, hasTimestamps };
}

/**
 * Parse plain text — mỗi dòng là một cue, startMs = endMs của cue trước.
 *
 * Hữu ích khi admin paste lời bài hát không có timestamp.
 * Bước align word-level timing sẽ dùng ASR để gán timing thực.
 *
 * `startOffsetMs`: thời điểm bắt đầu câu đầu tiên (mặc định 0).
 * `lineDurationMs`: thời lượng mỗi cue nếu chỉ có plain text (mặc định 3000ms).
 */
export function parsePlainText(
  content: string,
  options: { startOffsetMs?: number; lineDurationMs?: number } = {},
): LyricsCue[] {
  const startOffsetMs = options.startOffsetMs ?? 0;
  const lineDurationMs = options.lineDurationMs ?? 3000;
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return lines.map((text, index) => ({
    startMs: startOffsetMs + index * lineDurationMs,
    endMs: startOffsetMs + (index + 1) * lineDurationMs,
    text,
  }));
}

/**
 * Best-effort parser: thử LRC trước, fallback plain text.
 * Dùng cho endpoint upload LRC không cần client phân biệt format.
 */
export function parseLyricsSmart(content: string): ParsedLrc {
  const lrc = parseLRC(content);
  if (lrc.hasTimestamps) return lrc;
  const plain = parsePlainText(content);
  return {
    title: lrc.title,
    artist: lrc.artist,
    album: lrc.album,
    cues: plain,
    hasTimestamps: false,
  };
}
