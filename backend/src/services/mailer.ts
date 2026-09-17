import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

type MailTransport = Pick<Transporter, 'sendMail' | 'verify'>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

export class MailService {
  private transport?: MailTransport;

  constructor(transport?: MailTransport) {
    this.transport = transport;
  }

  isConfigured(): boolean {
    return Boolean(this.transport || (env.SMTP_HOST && env.SMTP_FROM));
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Dịch vụ email chưa được cấu hình');
    }
  }

  private getTransport(): MailTransport {
    this.assertConfigured();
    if (!this.transport) {
      this.transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
        connectionTimeout: env.SMTP_TIMEOUT_MS,
        greetingTimeout: env.SMTP_TIMEOUT_MS,
        socketTimeout: env.SMTP_TIMEOUT_MS,
      });
    }
    return this.transport;
  }

  async verifyConnection(): Promise<void> {
    await this.getTransport().verify();
  }

  async sendVerificationEmail(input: { to: string; name: string; token: string }): Promise<void> {
    const url = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(input.token)}`;
    await this.send({
      to: input.to,
      subject: 'Xác minh email HanFlix',
      text: `Xin chào ${input.name},\n\nXác minh email HanFlix tại: ${url}\n\nLiên kết hết hạn sau ${env.EMAIL_VERIFICATION_TTL_MINUTES} phút.`,
      html: `<p>Xin chào <strong>${escapeHtml(input.name)}</strong>,</p><p>Nhấn vào liên kết bên dưới để xác minh email HanFlix:</p><p><a href="${escapeHtml(url)}">Xác minh email</a></p><p>Liên kết hết hạn sau ${env.EMAIL_VERIFICATION_TTL_MINUTES} phút.</p>`,
    });
  }

  async sendPasswordResetEmail(input: { to: string; name: string; token: string }): Promise<void> {
    const url = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(input.token)}`;
    await this.send({
      to: input.to,
      subject: 'Đặt lại mật khẩu HanFlix',
      text: `Xin chào ${input.name},\n\nĐặt lại mật khẩu tại: ${url}\n\nLiên kết hết hạn sau ${env.PASSWORD_RESET_TTL_MINUTES} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `<p>Xin chào <strong>${escapeHtml(input.name)}</strong>,</p><p>Nhấn vào liên kết bên dưới để đặt lại mật khẩu:</p><p><a href="${escapeHtml(url)}">Đặt lại mật khẩu</a></p><p>Liên kết hết hạn sau ${env.PASSWORD_RESET_TTL_MINUTES} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });
  }

  private async send(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
    try {
      await this.getTransport().sendMail({
        from: env.SMTP_FROM,
        ...message,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } catch {
      throw new AppError(502, 'EMAIL_DELIVERY_FAILED', 'Không thể gửi email lúc này');
    }
  }
}

export const mailService = new MailService();
