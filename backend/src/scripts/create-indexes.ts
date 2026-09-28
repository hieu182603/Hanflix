import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import '../models/account-token.model.js';
import '../models/ai-conversation.model.js';
import '../models/ai-message.model.js';
import '../models/lesson.model.js';
import '../models/processing-job.model.js';
import '../models/progress.model.js';
import '../models/quiz-attempt.model.js';
import '../models/quiz.model.js';
import '../models/refresh-session.model.js';
import '../models/saved-word.model.js';
import '../models/study-activity.model.js';
import '../models/subtitle-track.model.js';
import '../models/user.model.js';
import '../models/vocabulary.model.js';
import '../models/word.model.js';
import '../models/practice.model.js';

async function main() {
  // Atlas Stable API strict mode rejects text-index DDL. Runtime connections remain strict;
  // this explicit migration command relaxes strictness only while creating indexes.
  await connectDatabase({ strictServerApi: false });
  const results = await Promise.all(mongoose.modelNames().map(async name => {
    await mongoose.model(name).createIndexes();
    return name;
  }));
  console.log(`Created or verified indexes for ${results.length} models`);
}

main().catch(error => {
  console.error('Index creation failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await disconnectDatabase();
});
