import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { GrammarModel } from '../src/models/grammar.model.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vietnamese translation map for grammar categories
const CAT_VI: Record<string, string> = {
  名词: 'Danh từ',
  动词: 'Động từ',
  能愿动词: 'Động từ năng nguyện',
  代词: 'Đại từ',
  疑问代词: 'Đại từ nghi vấn',
  人称代词: 'Đại từ nhân xưng',
  指示代词: 'Đại từ chỉ thị',
  数词: 'Số từ',
  量词: 'Lượng từ',
  名量词: 'Danh lượng từ',
  动量词: 'Động lượng từ',
  副词: 'Phó từ',
  程度副词: 'Phó từ mức độ',
  范围副词: 'Phó từ phạm vi',
  时间副词: 'Phó từ thời gian',
  否定副词: 'Phó từ phủ định',
  介词: 'Giới từ',
  连词: 'Liên từ',
  助词: 'Trợ từ',
  结构助词: 'Trợ từ kết cấu (的, 得, 地)',
  动态助词: 'Trợ từ động thái (了, 着, 过)',
  语气助词: 'Trợ từ ngữ khí (吗, 呢, 吧, 啊)',
  叹词: 'Thán từ',
  拟声词: 'Từ tượng thanh',
  词类: 'Từ loại',
  短语: 'Cụm từ',
  句子成分: 'Thành phần câu',
  主语: 'Chủ ngữ',
  谓语: 'Vị ngữ',
  宾语: 'Tân ngữ',
  定语: 'Định ngữ',
  状语: 'Trạng ngữ',
  补语: 'Bổ ngữ',
  结果补语: 'Bổ ngữ kết quả',
  程度补语: 'Bổ ngữ trình độ',
  状态补语: 'Bổ ngữ trạng thái',
  趋向补语: 'Bổ ngữ xu hướng',
  数量补语: 'Bổ ngữ số lượng',
  时量补语: 'Bổ ngữ thời lượng',
  可能补语: 'Bổ ngữ khả năng',
  句类: 'Loại câu',
  陈述句: 'Câu trần thuật',
  疑问句: 'Câu nghi vấn',
  是非问句: 'Câu hỏi Đúng / Sai (吗)',
  特指问句: 'Câu hỏi có đại từ nghi vấn',
  正反问句: 'Câu hỏi chính phản (A-not-A)',
  选择问句: 'Câu hỏi lựa chọn (还是)',
  祈使句: 'Câu cầu khiến',
  感叹句: 'Câu cảm thán',
  特殊句式: 'Câu đặc biệt',
  '“是”字句': 'Câu chữ “是”',
  '“有”字句': 'Câu chữ “有”',
  '“把”字句': 'Câu chữ “把”',
  '“被”字句': 'Câu chữ “被” (Bị động)',
  比较句: 'Câu so sánh (比, 没有, 一样)',
  存现句: 'Câu tồn hiện',
  连动句: 'Câu liên động',
  兼语句: 'Câu kiêm ngữ',
  复句: 'Câu phức',
  并列复句: 'Câu phức đẳng lập',
  递进复句: 'Câu phức tăng tiến (不但...而且...)',
  转折复句: 'Câu phức chuyển tiếp (虽然...但是...)',
  因果复句: 'Câu phức nguyên nhân kết quả (因为...所以...)',
  条件复句: 'Câu phức điều kiện (只要...就...)',
  假设复句: 'Câu phức giả thiết (如果...就...)',
};

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

async function seedGrammar() {
  console.log('Loading official HSK 7-9 grammar dataset from local JSON...');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const jsonPath = path.resolve(__dirname, '../data/hsk-7-9-grammar.json');
  const raw = await fs.readFile(jsonPath, 'utf8');
  const items = JSON.parse(raw) as Array<{
    no: number;
    category: string;
    subcategory: string;
    name: string;
    explanationVi: string;
    pattern: string;
    group: string;
    example?: { chinese: string; pinyin?: string; vietnamese?: string };
  }>;

  await connectDatabase();
  console.log('Connected to MongoDB. Deleting old HSK 7-9 entries...');
  await GrammarModel.deleteMany({ code: { $regex: /^GF7-/ } });
  console.log('Upserting new grammar items...');

  const bulkOps: any[] = [];
  let processed = 0;

  for (const item of items) {
    const code = `GF7-${String(item.no).padStart(3, '0')}`;
    const hskLevel: number = item.hskLevel ?? 7;
    const examples: any[] = [];
    if (item.example) {
      examples.push({
        chinese: item.example.chinese,
        pinyin: item.example.pinyin || '',
        vietnamese: item.example.vietnamese || '',
      });
    }

    bulkOps.push({
      updateOne: {
        filter: { code },
        update: {
          $set: {
            code,
            structure: item.name,
            pattern: item.pattern,
            group: item.group,
            category: item.category,
            details: item.subcategory,
            explanationVi: item.explanationVi,
            explanationEn: `HSK ${hskLevel} Grammar: ${item.name} (${item.group})`,
            hskLevel,
            status: 'published',
            tags: [`HSK ${hskLevel}`, item.subcategory, item.no >= 89 && item.no <= 90 ? '复句' : item.category].filter(Boolean),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            examples,
          },
        },
        upsert: true,
      },
    });

    if (bulkOps.length >= 200) {
      await GrammarModel.bulkWrite(bulkOps);
      processed += bulkOps.length;
      bulkOps.length = 0;
      if (processed % 50 === 0) console.log(`Processed ${processed} items...`);
    }
  }

  if (bulkOps.length > 0) {
    await GrammarModel.bulkWrite(bulkOps);
    processed += bulkOps.length;
  }

  console.log(`Seeded ${processed} official HSK 7-9 grammar points into MongoDB Atlas!`);
  await disconnectDatabase();
}

seedGrammar().catch(err => {
  console.error('Seed grammar failed:', err);
  process.exit(1);
});
