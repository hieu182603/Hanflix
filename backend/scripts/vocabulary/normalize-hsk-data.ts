import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeNormalizedKey, normalizePinyin } from '../../src/services/vocabulary.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.resolve(__dirname, '../../data/hsk/raw');
const OUT_DIR = path.resolve(__dirname, '../../data/hsk');
const OUT_FILE = path.join(OUT_DIR, 'hsk-vocabulary.json');
const ERROR_FILE = path.join(OUT_DIR, 'import-errors.json');

// Map POS shorthand to descriptive labels
const POS_MAP: Record<string, string> = {
  V: 'động từ',
  N: 'danh từ',
  Adj: 'tính từ',
  A: 'tính từ',
  Adv: 'phó từ',
  D: 'phó từ',
  Num: 'số từ',
  M: 'lượng từ',
  Pron: 'đại từ',
  R: 'đại từ',
  Prep: 'giới từ',
  P: 'giới từ',
  Conj: 'liên từ',
  C: 'liên từ',
  Aux: 'trợ từ',
  Part: 'trợ từ',
  U: 'trợ từ',
  Interj: 'thán từ',
  E: 'thán từ',
  Ono: 'từ tượng thanh',
  O: 'từ tượng thanh',
  Prefix: 'tiền tố',
  Suffix: 'hậu tố',
  Idiom: 'thành ngữ',
  I: 'thành ngữ',
};

// Topic tag keywords mapping for categorizing vocabulary
const TOPIC_KEYWORDS: Record<string, string[]> = {
  food: ['eat', 'drink', 'tea', 'coffee', 'water', 'rice', 'noodle', 'meat', 'beef', 'chicken', 'fish', 'soup', 'vegetable', 'fruit', 'apple', 'bread', 'restaurant', 'dish', 'cook', 'taste', 'sweet', 'delicious', 'ăn', 'uống', 'cơm', 'trà', 'thịt', 'món', 'nấu'],
  travel: ['go', 'fly', 'plane', 'airport', 'train', 'station', 'bus', 'subway', 'taxi', 'car', 'ticket', 'hotel', 'trip', 'travel', 'luggage', 'passport', 'city', 'map', 'tourist', 'đi', 'xe', 'máy bay', 'ga', 'vé', 'khách sạn', 'du lịch'],
  daily: ['home', 'house', 'family', 'father', 'mother', 'brother', 'sister', 'friend', 'room', 'door', 'bed', 'sleep', 'wake', 'morning', 'night', 'day', 'time', 'weather', 'sun', 'rain', 'nhà', 'gia đình', 'bố', 'mẹ', 'bạn', 'phòng', 'ngủ', 'ngày', 'mưa', 'nắng'],
  shopping: ['buy', 'sell', 'money', 'price', 'dollar', 'yuan', 'expensive', 'cheap', 'store', 'shop', 'market', 'clothes', 'shoe', 'shirt', 'bag', 'pay', 'cost', 'discount', 'mua', 'bán', 'tiền', 'giá', 'đắt', 'rẻ', 'cửa hàng', 'quần áo'],
  business: ['work', 'job', 'company', 'office', 'boss', 'manager', 'colleague', 'meeting', 'report', 'salary', 'contract', 'email', 'project', 'business', 'trade', 'market', 'làm việc', 'công ty', 'văn phòng', 'sếp', 'họp', 'báo cáo', 'lương'],
  entertainment: ['movie', 'film', 'music', 'song', 'sing', 'dance', 'game', 'play', 'sport', 'football', 'basketball', 'book', 'read', 'art', 'fun', 'happy', 'phim', 'nhạc', 'hát', 'chơi', 'bóng', 'sách', 'vui'],
};

function assignTags(simplified: string, pinyin: string, meanings: string[]): string[] {
  const tags = new Set<string>();
  const combined = (simplified + ' ' + pinyin + ' ' + meanings.join(' ')).toLowerCase();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        tags.add(topic);
        break;
      }
    }
  }

  return Array.from(tags);
}

// Simple RFC 4180 CSV line parser handling quoted fields with commas and double quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

interface NormalizedRecord {
  simplified: string;
  traditional?: string;
  pinyin: string;
  pinyinNumbered?: string;
  meanings: {
    vi: string[];
    en: string[];
  };
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6 | '7-9';
  partOfSpeech: string[];
  variants: string[];
  examples: Array<{ chinese: string; pinyin?: string; vietnamese?: string; english?: string }>;
  frequency?: number;
  tags: string[];
  source: Array<{ name: string; sourceId?: string }>;
  status: 'published' | 'draft' | 'pending_review';
}

async function normalize() {
  await mkdir(OUT_DIR, { recursive: true });

  const recordMap = new Map<string, NormalizedRecord>();
  const errors: Array<{ source: string; line: string; reason: string }> = [];

  // 1. Process ivankra_hsk30.csv for structure, POS, variants, CEDICT
  console.log('Parsing ivankra_hsk30.csv...');
  const ivankraRaw = await readFile(path.join(RAW_DIR, 'ivankra_hsk30.csv'), 'utf8');
  const ivanLines = ivankraRaw.split(/\r?\n/).filter(Boolean);
  const ivanHeader = ivanLines[0]?.split(',');

  for (let i = 1; i < ivanLines.length; i++) {
    const line = ivanLines[i];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    // ID,Simplified,Traditional,Pinyin,POS,Level,WebNo,WebPinyin,OCR,Variants,CEDICT
    const [id, simplifiedCol, traditionalCol, pinyinCol, posCol, levelCol, , , , variantsCol, cedictCol] = cols;

    if (!simplifiedCol || !pinyinCol || !levelCol) {
      errors.push({ source: 'ivankra', line, reason: 'Missing simplified, pinyin, or level' });
      continue;
    }

    // Level normalization: 1..6 or "7-9"
    let hskLevel: 1 | 2 | 3 | 4 | 5 | 6 | '7-9';
    const trimmedLvl = levelCol.trim();
    if (trimmedLvl === '7-9' || trimmedLvl === '7' || trimmedLvl === '8' || trimmedLvl === '9') {
      hskLevel = '7-9';
    } else {
      const num = Number(trimmedLvl);
      if (num >= 1 && num <= 6) {
        hskLevel = num as 1 | 2 | 3 | 4 | 5 | 6;
      } else {
        errors.push({ source: 'ivankra', line, reason: `Invalid level: ${levelCol}` });
        continue;
      }
    }

    // Simplified may contain multiple words like "爸爸|爸"
    const simplifiedList = simplifiedCol.split('|').map(s => s.trim()).filter(Boolean);
    const primarySimplified = simplifiedList[0];
    const pinyinList = pinyinCol.split('|').map(p => p.trim()).filter(Boolean);
    const primaryPinyin = pinyinList[0];

    // Part of speech
    const posList: string[] = [];
    if (posCol) {
      const parts = posCol.split(/[/,;]/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        posList.push(POS_MAP[p] || p);
      }
    }

    // Extract numbered pinyin from CEDICT e.g. "愛|爱[ai4]"
    let pinyinNumbered: string | undefined;
    if (cedictCol) {
      const match = cedictCol.match(/\[(.*?)\]/);
      if (match) pinyinNumbered = match[1];
    }

    // Variants
    const variants: string[] = [];
    if (simplifiedList.length > 1) {
      variants.push(...simplifiedList.slice(1));
    }

    const key = makeNormalizedKey(primarySimplified, primaryPinyin);

    const record: NormalizedRecord = {
      simplified: primarySimplified,
      traditional: traditionalCol?.split('|')[0]?.trim() || undefined,
      pinyin: primaryPinyin,
      pinyinNumbered,
      meanings: { vi: [], en: [] },
      hskLevel,
      partOfSpeech: Array.from(new Set(posList)),
      variants: Array.from(new Set(variants)),
      examples: [],
      tags: [],
      source: [{ name: 'ivankra/hsk30', sourceId: id }],
      status: 'published',
    };

    recordMap.set(key, record);
  }

  console.log(`Loaded ${recordMap.size} records from ivankra/hsk30.`);

  // 2. Process krmanik TSV files to supplement/verify HSK level and English meanings
  const krmanikFiles: Array<{ level: 1 | 2 | 3 | 4 | 5 | 6 | '7-9'; filename: string }> = [
    { level: 1, filename: 'krmanik_hsk1.tsv' },
    { level: 2, filename: 'krmanik_hsk2.tsv' },
    { level: 3, filename: 'krmanik_hsk3.tsv' },
    { level: 4, filename: 'krmanik_hsk4.tsv' },
    { level: 5, filename: 'krmanik_hsk5.tsv' },
    { level: 6, filename: 'krmanik_hsk6.tsv' },
    { level: '7-9', filename: 'krmanik_hsk7-9.tsv' },
  ];

  let krmanikMergedCount = 0;
  let krmanikNewCount = 0;

  for (const { level, filename } of krmanikFiles) {
    const filePath = path.join(RAW_DIR, filename);
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      // Format: Traditional \t Simplified \t Pinyin \t Meaning
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const [traditional, simplified, pinyin, rawMeaning] = parts.map(p => p?.trim() || '');
      if (!simplified || !pinyin) continue;

      // Clean meaning string into array
      const meaningsEn: string[] = [];
      if (rawMeaning) {
        const splitMeanings = rawMeaning
          .split(/[,;/]+/)
          .map(m => m.trim().replace(/^det\.:\s*/, '').replace(/^m\.:\s*/, ''))
          .filter(m => m.length > 0 && !m.startsWith('CL:'));
        meaningsEn.push(...splitMeanings);
      }

      const key = makeNormalizedKey(simplified, pinyin);
      const existing = recordMap.get(key);

      if (existing) {
        // Merge
        existing.hskLevel = level; // krmanik is primary authority on level
        if (!existing.traditional && traditional) existing.traditional = traditional;
        const currentEn = new Set(existing.meanings.en);
        for (const m of meaningsEn) {
          if (!currentEn.has(m)) {
            existing.meanings.en.push(m);
            currentEn.add(m);
          }
        }
        if (!existing.source.some(s => s.name === 'krmanik/HSK-3.0')) {
          existing.source.push({ name: 'krmanik/HSK-3.0' });
        }
        krmanikMergedCount++;
      } else {
        // New record not present in ivankra
        const newRecord: NormalizedRecord = {
          simplified,
          traditional: traditional || undefined,
          pinyin,
          meanings: { vi: [], en: meaningsEn },
          hskLevel: level,
          partOfSpeech: [],
          variants: [],
          examples: [],
          tags: [],
          source: [{ name: 'krmanik/HSK-3.0' }],
          status: 'published',
        };
        recordMap.set(key, newRecord);
        krmanikNewCount++;
      }
    }
  }

  console.log(`Merged ${krmanikMergedCount} existing records and added ${krmanikNewCount} new records from krmanik.`);

  // 3. Enrich records with topic tags & Vietnamese meanings from sample dataset if available
  let viMeaningCount = 0;
  try {
    const fixturePath = path.resolve(__dirname, '../../../doc/HanFlix_04_Du_Lieu_Mau.json');
    const fixtureJson = JSON.parse(await readFile(fixturePath, 'utf8'));
    if (Array.isArray(fixtureJson.words)) {
      for (const w of fixtureJson.words) {
        if (!w.hanzi || !w.pinyin) continue;
        const key = makeNormalizedKey(w.hanzi, w.pinyin);
        const rec = recordMap.get(key);
        if (rec && w.meaningVi) {
          if (!rec.meanings.vi.includes(w.meaningVi)) {
            rec.meanings.vi.push(w.meaningVi);
            viMeaningCount++;
          }
        }
      }
    }
  } catch (err) {
    // Optional enrichment
  }

  // Tag assignment
  for (const record of recordMap.values()) {
    record.tags = assignTags(record.simplified, record.pinyin, record.meanings.en);
  }

  const outputList = Array.from(recordMap.values());
  console.log(`Writing ${outputList.length} normalized vocabulary records to ${OUT_FILE}...`);
  await writeFile(OUT_FILE, JSON.stringify(outputList, null, 2), 'utf8');

  if (errors.length > 0) {
    await writeFile(ERROR_FILE, JSON.stringify(errors, null, 2), 'utf8');
    console.log(`Logged ${errors.length} errors to ${ERROR_FILE}.`);
  }

  console.log(`
Normalization Summary:
Total Normalized Records: ${outputList.length}
With Vietnamese Meanings: ${viMeaningCount}
HSK 1: ${outputList.filter(r => r.hskLevel === 1).length}
HSK 2: ${outputList.filter(r => r.hskLevel === 2).length}
HSK 3: ${outputList.filter(r => r.hskLevel === 3).length}
HSK 4: ${outputList.filter(r => r.hskLevel === 4).length}
HSK 5: ${outputList.filter(r => r.hskLevel === 5).length}
HSK 6: ${outputList.filter(r => r.hskLevel === 6).length}
HSK 7-9: ${outputList.filter(r => r.hskLevel === '7-9').length}
  `);
}

normalize().catch(err => {
  console.error('Normalization failed:', err);
  process.exit(1);
});
