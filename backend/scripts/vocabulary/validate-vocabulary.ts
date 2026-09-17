import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabularyValidationSchema, makeNormalizedKey } from '../../src/services/vocabulary.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../data/hsk/hsk-vocabulary.json');

async function validate() {
  console.log(`Loading dataset from ${DATA_FILE}...`);
  const raw = await readFile(DATA_FILE, 'utf8');
  const items: any[] = JSON.parse(raw);

  console.log(`Validating ${items.length} records...`);

  let validCount = 0;
  let invalidCount = 0;
  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  const errors: Array<{ index: number; word: string; error: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = makeNormalizedKey(item.simplified || '', item.pinyin || '');

    if (seenKeys.has(key)) {
      duplicateKeys.add(key);
    }
    seenKeys.add(key);

    const parsed = vocabularyValidationSchema.safeParse(item);
    if (parsed.success) {
      validCount++;
    } else {
      invalidCount++;
      if (errors.length < 20) {
        errors.push({
          index: i,
          word: item.simplified,
          error: parsed.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', '),
        });
      }
    }
  }

  console.log(`
--- Validation Report ---
Total Records: ${items.length}
Valid Records: ${validCount}
Invalid Records: ${invalidCount}
Duplicate Keys: ${duplicateKeys.size}
-------------------------
`);

  if (errors.length > 0) {
    console.error('Sample Errors:', errors);
    process.exit(1);
  }

  if (duplicateKeys.size > 0) {
    console.error('Found duplicate keys:', Array.from(duplicateKeys).slice(0, 10));
    process.exit(1);
  }

  console.log('Validation passed successfully! 100% of records conform to schema.');
}

validate().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
