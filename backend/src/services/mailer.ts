import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

type MailTransport = Pick<Transporter, 'sendMail' | 'verify'>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function getPublicLogoUrl(): string {
  return `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/favicon.png`;
}

interface EmailLayoutOptions {
  name: string;
  badge: string;
  title: string;
  description: string;
  code?: string;
  ttlMinutes: number;
  ctaText: string;
  actionUrl: string;
  securityNotice: string;
}

function buildHtmlEmail(options: EmailLayoutOptions): string {
  const logoSrc = getPublicLogoUrl();

  const rawCode = options.code?.trim() || '';
  const digits = rawCode.length === 6 ? rawCode.split('') : [];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFF9F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #18181B;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFF9F5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 22px; overflow: hidden; box-shadow: 0 12px 36px rgba(180, 60, 20, 0.08); border: 1px solid #F2E4D8;">
          <!-- Clean Porcelain White Header (Option A) -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 36px 24px 20px 24px; text-align: center; border-bottom: 1px solid #F2E4D8;">
              <img src="${logoSrc}" width="64" height="64" alt="HanFlix" style="display: block; margin: 0 auto 12px auto; width: 64px; height: 64px; border-radius: 16px; object-fit: contain;" />
              <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #18181B; text-transform: uppercase;">
                HAN<span style="color: #E50914;">FLIX</span>
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #8B9097; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 4px;">
                Nền tảng học tiếng Trung tương tác
              </div>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <!-- Soft Peach Pill Badge -->
              <div style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #B91B1C; background-color: #FDF1F1; border: 1px solid #F5CACA; padding: 4px 14px; border-radius: 9999px; margin-bottom: 16px;">
                ${escapeHtml(options.badge)}
              </div>

              <!-- Title & Greeting -->
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 900; color: #18181B; line-height: 1.3;">
                ${escapeHtml(options.title)}
              </h1>
              <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #18181B;">
                Xin chào <strong>${escapeHtml(options.name)}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #5F6368;">
                ${escapeHtml(options.description)}
              </p>

              <!-- 6-Box OTP Display Block -->
              ${digits.length === 6 ? `
              <div style="background-color: #FFF9F5; border: 1.5px solid #F2E4D8; border-radius: 18px; padding: 24px 16px; text-align: center; margin                  <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #B91B1C; margin-bottom: 16px;">
                    MÃ XÁC THỰC OTP (HẾT HẠN VÀ TỰ HỦY SAU 1 PHÚT)
                  </div>
                  <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      ${digits.map(d => `
                        <td style="padding: 0 4px;">
                          <div style="width: 44px; height: 52px; line-height: 52px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 900; color: #E50914; background-color: #FFFFFF; border: 2px solid #E50914; border-radius: 12px; box-shadow: 0 2px 8px rgba(229, 9, 20, 0.12);">
                            ${escapeHtml(d)}
                          </div>
                        </td>
                      `).join('')}
                    </tr>
                  </table>
                  <div style="font-size: 12px; color: #8B9097; font-weight: 500; margin-top: 14px;">
                    Mã OTP chỉ có hiệu lực trong 1 phút. Sau 1 phút nếu không xác thực, mã sẽ bị hủy tự động.
                  </div>
                </div>
                ` : (options.code ? `
                <div style="background-color: #FFF9F5; border: 1.5px solid #F2E4D8; border-radius: 18px; padding: 20px; text-align: center; margin: 24px 0;">
                  <div style="font-size: 28px; font-weight: 900; color: #E50914; letter-spacing: 8px;">
                    ${escapeHtml(options.code)}
                  </div>
                </div>
                ` : '')}

                <!-- Primary CTA Button -->
                <div style="text-align: center; margin: 28px 0 20px 0;">
                  <a href="${escapeHtml(options.actionUrl)}" target="_blank" style="display: inline-block; background-color: #E50914; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 9999px; box-shadow: 0 8px 20px rgba(229, 9, 20, 0.25);">
                    ${escapeHtml(options.ctaText)}
                  </a>
                </div>



                <!-- Subtle Divider -->
                <div style="border-top: 1px solid #F2E4D8; margin: 28px 0 20px 0;"></div>

                <!-- Security Notice -->
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #5F6368; text-align: center;">
                  ${escapeHtml(options.securityNotice)}
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #FFF9F5; padding: 20px 24px; text-align: center; border-top: 1px solid #F2E4D8;">
                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #5F6368;">
                  © ${new Date().getFullYear()} HanFlix Inc. Mọi quyền được bảo lưu.
                </p>
                <p style="margin: 0; font-size: 11px; color: #8B9097;">
                  Bảo mật tài khoản của bạn là ưu tiên hàng đầu của chúng tôi.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
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

  async sendVerificationEmail(input: { to: string; name: string; token: string; code?: string }): Promise<void> {
    const url = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(input.token)}`;
    const codeText = input.code ? `Mã xác minh 6 số (hết hạn sau 1 phút): ${input.code}\n\n` : '';

    const html = buildHtmlEmail({
      name: input.name,
      badge: 'Xác thực tài khoản',
      title: 'Xác minh địa chỉ email của bạn',
      description: 'Cảm ơn bạn đã đăng ký tài khoản tại HanFlix! Hãy sử dụng mã OTP 6 số bên dưới hoặc nhấn nút xác nhận để kích hoạt tài khoản. Mã OTP sẽ hết hạn và tự động hủy sau 1 phút.',
      code: input.code,
      ttlMinutes: 1,
      ctaText: 'Xác minh email ngay',
      actionUrl: url,
      securityNotice: 'Nếu bạn không đăng ký tài khoản HanFlix, vui lòng bỏ qua email này.',
    });

    await this.send({
      to: input.to,
      subject: 'Xác minh email HanFlix',
      text: `Xin chào ${input.name},\n\n${codeText}Xác minh email HanFlix tại: ${url}\n\nLiên kết hết hạn sau ${env.EMAIL_VERIFICATION_TTL_MINUTES} phút. Mã OTP hết hạn sau 1 phút.`,
      html,
    });
  }

  async sendPasswordResetEmail(input: { to: string; name: string; token: string; code?: string }): Promise<void> {
    const url = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(input.token)}`;
    const codeText = input.code ? `Mã đặt lại mật khẩu 6 số (hết hạn sau 1 phút): ${input.code}\n\n` : '';

    const html = buildHtmlEmail({
      name: input.name,
      badge: 'Bảo mật tài khoản',
      title: 'Yêu cầu đặt lại mật khẩu',
      description: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản HanFlix của bạn. Hãy sử dụng mã OTP 6 số bên dưới để tiếp tục. Mã OTP sẽ hết hạn và tự động hủy sau 1 phút.',
      code: input.code,
      ttlMinutes: 1,
      ctaText: 'Đặt lại mật khẩu',
      actionUrl: url,
      securityNotice: 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.',
    });

    await this.send({
      to: input.to,
      subject: 'Đặt lại mật khẩu HanFlix',
      text: `Xin chào ${input.name},\n\n${codeText}Đặt lại mật khẩu tại: ${url}\n\nLiên kết hết hạn sau ${env.PASSWORD_RESET_TTL_MINUTES} phút. Mã OTP hết hạn sau 1 phút.`,
      html,
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
