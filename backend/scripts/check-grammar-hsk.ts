import mongoose from 'mongoose';

async function check(dbName: string) {
  const conn = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`).asPromise();
  const cnt = await conn.db!.collection('grammars').countDocuments();
  console.log(`DB ${dbName} grammars:`, cnt);
  if (cnt > 0) {
    // Check each hsk level
    const all = await conn.db!.collection('grammars').find({}, {projection: {hskLevel:1, status:1, structure:1} as any}).toArray();
    const byLevel: Record<string, any> = {};
    for (const doc of all as any[]) {
      const lvl = String(doc.hskLevel);
      if (!byLevel[lvl]) byLevel[lvl] = {total: 0, published: 0, sample: null, types: new Set<string>()};
      byLevel[lvl].total += 1;
      byLevel[lvl].types.add(typeof doc.hskLevel);
      if (doc.status === 'published') byLevel[lvl].published += 1;
      if (!byLevel[lvl].sample) byLevel[lvl].sample = doc.structure;
    }
    Object.entries(byLevel).forEach(([lvl, data]: any) => {
      data.types = Array.from(data.types);
    });
    console.log(JSON.stringify(byLevel, null, 2));
  }
  await conn.close();
}

async function main() {
  for (const db of ['hanflix', 'hanflix-dev']) {
    await check(db);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
