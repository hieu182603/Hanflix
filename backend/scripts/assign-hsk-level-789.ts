import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.resolve(__dirname, '../data/hsk-7-9-grammar.json');

async function main() {
  const raw = await fs.readFile(jsonPath, 'utf8');
  const items = JSON.parse(raw) as Array<{ no: number; [k: string]: any }>;

  const stats: Record<number, number> = {};
  for (const item of items) {
    const no = item.no;
    let hskLevel: number;
    if (no >= 1 && no <= 58) {
      // 词类 (verbs, pronouns, measure words, adverbs, prepositions, conjunctions, particles)
      hskLevel = 7;
    } else if (no >= 59 && no <= 84) {
      // 短语 (59-79) + 固定格式 (80-84)
      hskLevel = 8;
    } else if (no >= 85 && no <= 148) {
      // 句子成分 (85-87) + 句子的类型 (88-90) + 复句 (91-128) + 强调 (129) + 口语格式 (130-144) + 句群 (145-148)
      hskLevel = 9;
    } else {
      hskLevel = 9;
    }
    (item as any).hskLevel = hskLevel;
    stats[hskLevel] = (stats[hskLevel] || 0) + 1;
  }

  await fs.writeFile(jsonPath, JSON.stringify(items, null, 2), 'utf8');
  console.log('Updated', items.length, 'items.');
  console.log('Stats:', stats);
}

main().catch((e) => { console.error(e); process.exit(1); });
