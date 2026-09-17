import { mailService } from '../services/mailer.js';

mailService.verifyConnection()
  .then(() => console.log('SMTP connection verified successfully.'))
  .catch(error => {
    console.error('SMTP verification failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
