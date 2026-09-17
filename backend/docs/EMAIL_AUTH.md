# Email verification and password security

HanFlix sends transactional email through Nodemailer SMTP. Configure one SMTP provider in the backend/Azure Container App only; never expose these values through Vite variables.

## Environment

```env
APP_PUBLIC_URL=https://app.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=HanFlix <no-reply@example.com>
SMTP_TIMEOUT_MS=10000
EMAIL_VERIFICATION_TTL_MINUTES=1440
PASSWORD_RESET_TTL_MINUTES=30
```

Use `SMTP_SECURE=true` for implicit TLS on port 465. Port 587 normally uses `SMTP_SECURE=false` and upgrades with STARTTLS. Add these values as Azure Container Apps secrets/environment variables.

After configuring a local `.env`, verify credentials without sending a message:

```powershell
cd E:\Hanflix\backend
npm run email:verify
```

Production DNS should configure SPF, DKIM and DMARC according to the selected provider. A live inbox/spam-folder test is still required before launch.

## API flow

- `POST /api/v1/auth/register`: creates an unverified password account and sends a verification link. It intentionally does not issue login tokens.
- `POST /api/v1/auth/verify-email`: consumes `{ token }` once and verifies the account.
- `POST /api/v1/auth/resend-verification`: accepts `{ email }` and always returns a generic accepted response.
- `POST /api/v1/auth/forgot-password`: accepts `{ email }`, returns a generic response, and sends a reset link only for an eligible password account.
- `POST /api/v1/auth/reset-password`: consumes `{ token, password }`, updates the password and revokes all old refresh sessions.
- `POST /api/v1/auth/change-password`: authenticated `{ currentPassword, newPassword }`; revokes old refresh sessions and returns a replacement access/refresh session.

Google ID tokens contain a Google-verified email, so Google-created accounts are marked verified. Linking Google to an existing account requires the same email and also verifies it.

Raw verification/reset tokens are never stored. MongoDB stores SHA-256 hashes in `accounttokens`; tokens are single-use and have a TTL index. Existing users created before this feature keep working because only accounts explicitly marked `emailVerificationRequired: true` are blocked.
