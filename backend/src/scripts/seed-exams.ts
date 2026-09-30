import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { examSeeds } from '../data/exam-seeds.js';
import { importExams } from '../services/exam.service.js';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';

try {
  await connectDatabase();
  await ExamAttemptModel.init();
  const result = await importExams(examSeeds);
  console.log(`Imported ${result.imported} sample exams: ${result.codes.join(', ')}`);
} catch (error) {
  console.error('Exam seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
