import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const messages = JSON.parse(fs.readFileSync('src/i18n/messages.json','utf8'));
const missing = new Map();
function scan(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) { scan(file); continue; }
    if(!file.endsWith('.tsx') || file.includes('.test.')) continue;
    const text=fs.readFileSync(file,'utf8');
    if(!text.includes('useI18n')) continue;
    const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    function visit(node) {
      if(ts.isCallExpression(node) && node.expression.getText(source)==='tr' && ts.isStringLiteral(node.arguments[0]) && !messages[node.arguments[0].text]) {
        missing.set(node.arguments[0].text,file);
      }
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
}
scan('src/components');
for(const [key,file] of missing) console.log(`${file}: ${key}`);
console.log(`Missing translations: ${missing.size}`);
process.exitCode=missing.size?1:0;
