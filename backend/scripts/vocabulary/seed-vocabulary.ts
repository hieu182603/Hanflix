import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { VocabularyModel } from '../../src/models/vocabulary.model.js';
import { vocabularyService } from '../../src/services/vocabulary.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../data/hsk/hsk-vocabulary.json');

async function seed() {
  console.log(`Starting HSK Vocabulary Seed...`);
  console.log(`Reading dataset from ${DATA_FILE}...`);

  const raw = await readFile(DATA_FILE, 'utf8');
  const items: any[] = JSON.parse(raw);

  await connectDatabase();
  console.log('Connected to MongoDB database.');

  // Create indexes if they don't exist yet
  await VocabularyModel.createIndexes();

  const mode = (process.env.IMPORT_MODE as 'skip_existing' | 'update_existing' | 'insert_only') || 'skip_existing';
  console.log(`Executing batch import with mode: ${mode}...`);

  const result = await vocabularyService.processBatchImport(items, {
    mode,
    dryRun: false,
  });

  const { summary } = result;

  console.log(`
HSK Vocabulary Import

Source records: ${summary.total}
Valid records: ${summary.valid}
Inserted: ${summary.inserted}
Updated: ${summary.updated}
Skipped: ${summary.skipped}
Duplicates: ${summary.duplicatesInInput}
Invalid: ${summary.invalid}

Completed successfully.
`);
}

seed()
  .catch(err => {
    console.error('HSK Vocabulary Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
    console.log('Disconnected from database.');
  });
