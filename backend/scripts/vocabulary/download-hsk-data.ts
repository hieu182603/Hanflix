import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.resolve(__dirname, '../../data/hsk/raw');

const KROMANIK_FILES = [
  { level: '1', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%201.tsv', filename: 'krmanik_hsk1.tsv' },
  { level: '2', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%202.tsv', filename: 'krmanik_hsk2.tsv' },
  { level: '3', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%203.tsv', filename: 'krmanik_hsk3.tsv' },
  { level: '4', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%204.tsv', filename: 'krmanik_hsk4.tsv' },
  { level: '5', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%205.tsv', filename: 'krmanik_hsk5.tsv' },
  { level: '6', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%206.tsv', filename: 'krmanik_hsk6.tsv' },
  { level: '7-9', url: 'https://raw.githubusercontent.com/krmanik/HSK-3.0/main/New%20HSK%20(2021)/HSK%20List%20(Meaning)/HSK%207-9.tsv', filename: 'krmanik_hsk7-9.tsv' },
];

const IVANKRA_FILE = {
  url: 'https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30.csv',
  filename: 'ivankra_hsk30.csv',
};

async function downloadFile(url: string, destPath: string) {
  console.log(`Downloading: ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  await writeFile(destPath, text, 'utf8');
  console.log(`Saved (${text.length} bytes) to ${destPath}`);
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  console.log(`Downloading HSK datasets to: ${RAW_DIR}`);

  for (const item of KROMANIK_FILES) {
    const dest = path.join(RAW_DIR, item.filename);
    await downloadFile(item.url, dest);
  }

  const ivanDest = path.join(RAW_DIR, IVANKRA_FILE.filename);
  await downloadFile(IVANKRA_FILE.url, ivanDest);

  console.log('All HSK raw datasets downloaded successfully.');
}

main().catch(err => {
  console.error('Download failed:', err);
  process.exit(1);
});
