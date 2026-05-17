# Security Rules (Non-Negotiable)

## Mandatory Security Requirements

1. **Idempotency:** All critical `POST`/`PUT`/`PATCH` MUST validate `Idempotency-Key` header
2. **Two-Phase File Upload:** Upload → Temp → Commit → Permanent
3. **Race Conditions:** Redis Redlock + TypeORM `@VersionColumn` for Document Numbering
4. **Validation:** Zod (frontend) + class-validator (backend DTO)
5. **Password:** bcrypt 12 salt rounds, min 8 chars, rotate every 90 days
6. **Rate Limiting:** `ThrottlerGuard` on all auth endpoints
7. **File Upload:** Whitelist PDF/DWG/DOCX/XLSX/ZIP, max 50MB, ClamAV scan
8. **AI Isolation (ADR-018):** Ollama on Admin Desktop ONLY — NO direct DB/storage access
9. **Error Handling (ADR-007):** Use layered error classification with user-friendly messages
10. **AI Integration (ADR-020):** RFA-First approach with unified pipeline architecture
11. **AI Audit Trail:** Log all AI interactions and human validations
12. **Rate Limiting:** Apply to AI endpoints to prevent abuse

## Full Documentation

`specs/06-Decision-Records/ADR-016-security-authentication.md`

## Security Checklist (Before Every Commit)

- [ ] Input validation implemented (Zod/class-validator)
- [ ] RBAC/CASL permissions checked
- [ ] No SQL injection vulnerabilities
- [ ] File upload validation (whitelist + ClamAV)
- [ ] Rate limiting applied to auth endpoints
- [ ] AI boundary enforcement (ADR-023) - no direct DB/storage access
- [ ] AI audit logging implemented for AI interactions
- [ ] AI outputs validated before use (human-in-the-loop)
- [ ] Error handling follows ADR-007 layered classification
- [ ] Cache invalidation when data modified
- [ ] OWASP Top 10 review passed
