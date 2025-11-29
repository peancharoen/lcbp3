---
trigger: always_on
---

# 📏 Coding Standards (Strict Rules)

1.  **Language:** - Code logic & Naming: **English**.
    - Comments & Documentation: **Thai Language (ภาษาไทย)**.
2.  **File Structure:** Follow `kebab-case` for files (e.g., `user-service.ts`).
3.  **Comments:** Add `// File: path/to/file` at the top of every file.
4.  **Secrets:** NEVER hardcode secrets. Use `process.env` and assume `docker-compose.override.yml` is used for local dev.
