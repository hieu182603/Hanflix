import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Transporter } from 'nodemailer';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
});

describe('MailService', () => {
  it('sends multipart verification mail without file or URL access', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'mail-1' });
    const verify = vi.fn().mockResolvedValue(true);
    const { MailService } = await import('./mailer.js');
    const service = new MailService({ sendMail, verify } as unknown as Pick<Transporter, 'sendMail' | 'verify'>);

    await service.sendVerificationEmail({ to: 'learner@example.com', name: '<Learner>', token: 'secret token' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'learner@example.com',
      subject: expect.stringContaining('Xác minh'),
      text: expect.stringContaining('secret%20token'),
      html: expect.stringContaining('&lt;Learner&gt;'),
      disableFileAccess: true,
      disableUrlAccess: true,
    }));
  });

  it('normalizes provider failures to a safe API error', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('SMTP credentials rejected'));
    const { MailService } = await import('./mailer.js');
    const service = new MailService({ sendMail, verify: vi.fn() } as unknown as Pick<Transporter, 'sendMail' | 'verify'>);
    await expect(service.sendPasswordResetEmail({
      to: 'learner@example.com', name: 'Learner', token: 'token',
    })).rejects.toMatchObject({ statusCode: 502, code: 'EMAIL_DELIVERY_FAILED' });
  });
});
