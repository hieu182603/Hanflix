# Learner interface translations

Supported languages: Vietnamese (`vi`, default), English (`en`), Simplified Chinese (`zh`).

`LanguageProvider` remembers the learner preference in `hanflix_language`, synchronizes it across browser tabs and works when storage is unavailable. `LearnerLanguageScope` enables translations only for authenticated non-admin learner screens. Public pages, authentication, admin and session restoration use Vietnamese without clearing the saved preference. The authenticated onboarding screen has its own language selector.

## Adding interface text

- Use `const { tr, ui, locale } = useI18n()` and retain only the helpers needed by the component.
- Add a Vietnamese source key to `messages.json` with `[English, Chinese]` translations. Use `tr('Hết hạn sau {0}', { 0: countdown })` for interpolation; all translations must retain the same placeholders.
- Use `ui(value)` only for known interface labels or messages held in state/API responses. It recognizes exact catalog entries and catalog templates with already interpolated values; unknown strings remain unchanged.
- Keep lesson titles, subtitles, dictionary meanings, exercises, learner names and authored messages unchanged. Never apply `ui` to a container or traverse the rendered DOM to translate content.
- Format display dates and numbers with `locale`. Do not change API values, filter IDs, payment amounts, or the fixed business timezone used to calculate streaks.
- Shared notification/select/pagination components inherit the current scope. Avoid creating a separate provider in a modal or portal.

The existing typed `t` dictionary remains available for navigation and streak components. Keep its language structures in sync.

## Checks

Run from `frontend`:

```sh
npm run check:i18n
npm run typecheck
npm test
npm run test:e2e -- e2e/i18n.spec.ts
npm run build
```

The catalog check catches missing literal `tr` keys. Unit tests validate placeholders, persistence, storage failures and scope. Browser tests cover language switching/reload, learner routes in English/Chinese, checkout, mobile settings and Vietnamese public/admin screens. API responses in browser tests are mocked; they do not verify a live payment provider.
