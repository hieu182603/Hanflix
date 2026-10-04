import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { migratePremiumHistory } from '../src/services/premium-history-migration.js';
import { logger } from '../src/services/logger.js';

// Dry-run by default; explicitly pass --apply after reviewing the counts.
try {
  await connectDatabase();
  logger.info(await migratePremiumHistory(!process.argv.includes('--apply')), 'PREMIUM_HISTORY_MIGRATION');
} catch (error) {
  logger.error({ error }, 'PREMIUM_HISTORY_MIGRATION_FAILED');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
