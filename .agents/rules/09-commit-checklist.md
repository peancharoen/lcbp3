
# Commit Checklist

## Pre-Commit Verification

- [ ] UUID pattern verified (no parseInt on UUID)
- [ ] No `any` types in TypeScript
- [ ] No `console.log` in committed code
- [ ] Comments in Thai
- [ ] Code identifiers in English
- [ ] Schema changes via SQL directly (not migration)
- [ ] Test coverage meets targets (Backend 70%+, Business Logic 80%+)
- [ ] Relevant ADRs checked (ADR-009, ADR-018, ADR-019)
- [ ] Glossary terms used correctly
- [ ] Error handling complete (Logger + HttpException)
- [ ] i18n keys used instead of hardcode text
- [ ] Cache invalidation when data modified
- [ ] Security checklist passed (OWASP Top 10)

## Commit Message Format

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(correspondence): add originator organization validation`
- `fix(uuid): correct parseInt usage to string comparison`
- `spec(agents): bump to v1.8.5 - refactor structure`
