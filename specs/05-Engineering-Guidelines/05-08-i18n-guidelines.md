# i18n Guidelines

**Version:** 1.8.4  
**Last Updated:** 2026-03-24  
**Location:** `specs/05-Engineering-Guidelines/05-08-i18n-guidelines.md`

---

## Code Comments & Documentation

- ✅ **Comments:** Write in Thai (for team understanding)
- ✅ **JSDoc:** Use Thai to explain business logic
- ✅ **Error messages:** Store as keys in i18n files, not hardcoded

---

## i18n Structure (Frontend)

```
locales/
├── th/
│   ├── common.json      # General messages
│   ├── errors.json      # Error messages
│   ├── forms.json       # Form labels & validation
│   └── modules/
│       ├── correspondence.json
│       └── rfa.json
└── en/                  # Reserved for future
```

---

## Validation Messages (Zod)

```typescript
// ✅ CORRECT — Use reference key
z.string().min(3, { message: 'errors:min_length_3' });
// Then resolve in frontend via i18n hook

// ❌ WRONG — Hardcode Thai in schema
z.string().min(3, 'กรุณากรอกอย่างน้อย 3 ตัวอักษร'); // Makes testing difficult
```

---

## Language Rules Summary

| Context         | Language   |
| --------------- | ---------- |
| Code (variables, functions, classes) | English |
| Comments        | Thai       |
| JSDoc           | Thai       |
| Error messages  | i18n keys  |
| UI labels       | i18n files |
| Documentation   | Thai       |

---

## Reference

- [Frontend Guidelines](05-03-frontend-guidelines.md)
- [Glossary](../00-overview/00-02-glossary.md)
