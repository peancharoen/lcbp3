---
trigger: always_on
---

# ✅ Quick Reference Checklist (Before Every Commit)

- [ ] UUID pattern verified (no parseInt on UUID)
- [ ] No `any` types in TypeScript
- [ ] No `console.log` in committed code
- [ ] Comments in Thai, Code identifiers in English
- [ ] Schema changes via SQL directly (not migration)
- [ ] Relevant ADRs checked (ADR-009, ADR-018, ADR-019)
- [ ] i18n keys used instead of hardcode text
