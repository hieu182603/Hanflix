import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { GrammarModel } from '../src/models/grammar.model.js';

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
  console.log('Downloading official HSK 3.0 grammar dataset...');
  const res = await fetch('https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30-grammar.csv');
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const csvText = await res.text();
  const lines = csvText.split(/\r?\n/).filter(Boolean);

  await connectDatabase();
  console.log('Connected to MongoDB. Parsing grammar items...');

  const bulkOps: any[] = [];
  let processed = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = parseCsvLine(line);
    // No,Level,Group,Category,Details,Content
    const [no, levelStr, group, category, details, content] = cols.map(c => c?.trim() || '');
    if (!levelStr || (!category && !details && !content)) continue;

    let hskLevel: 1 | 2 | 3 | 4 | 5 | 6 | '7-9' = 1;
    if (levelStr === '7-9' || levelStr === '7' || levelStr === '8' || levelStr === '9') {
      hskLevel = '7-9';
    } else {
      const num = Number(levelStr);
      if (num >= 1 && num <= 6) hskLevel = num as any;
    }

    const structureName = details || category || content || `Điểm ngữ pháp #${no}`;
    const code = `GF-${String(no).padStart(3, '0')}`;
    const viExplanation = CAT_VI[details] || CAT_VI[category] || CAT_VI[group] || `Cấu trúc ${structureName}`;
    const patternStr = content ? `Ví dụ / Từ vựng: ${content}` : '';

    bulkOps.push({
      updateOne: {
        filter: { code },
        update: {
          $set: {
            code,
            structure: structureName,
            pattern: patternStr,
            group: group || 'Ngữ pháp',
            category: category || '',
            details: details || '',
            explanationVi: viExplanation,
            explanationEn: `Grammar structure: ${structureName} (${group})`,
            hskLevel,
            status: 'published',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            examples: content ? [{ chinese: content.split('、')[0] || content, pinyin: '', vietnamese: viExplanation }] : [],
          },
        },
        upsert: true,
      },
    });

    if (bulkOps.length >= 200) {
      await GrammarModel.bulkWrite(bulkOps);
      processed += bulkOps.length;
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await GrammarModel.bulkWrite(bulkOps);
    processed += bulkOps.length;
  }

  console.log(`Seeded ${processed} official HSK grammar points successfully into MongoDB Atlas!`);
  await disconnectDatabase();
}

seedGrammar().catch(err => {
  console.error('Seed grammar failed:', err);
  process.exit(1);
});
