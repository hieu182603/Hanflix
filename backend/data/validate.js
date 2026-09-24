const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('e:/Hanflix/backend/data/hsk-7-9-grammar.json', 'utf8'));
  console.log('Valid JSON, count:', Array.isArray(data) ? data.length : 'NOT_ARRAY', 'isArray:', Array.isArray(data));
  if (Array.isArray(data)) {
    console.log('First item sample:', JSON.stringify(data[0]).substring(0, 200));
    console.log('Last item sample:', JSON.stringify(data[data.length-1]).substring(0, 200));
  }
} catch (e) {
  console.error('INVALID:', e.message);
  // Find approximate line number
  const content = fs.readFileSync('e:/Hanflix/backend/data/hsk-7-9-grammar.json', 'utf8');
  console.log('Length:', content.length);
}
