---
trigger: always_on
---

# 🆔 Identifier Strategy (ADR-019) — CRITICAL

| Context          | Type                      | Notes                                       |
| ---------------- | ------------------------- | ------------------------------------------- |
| Internal / DB FK | `INT AUTO_INCREMENT`      | Never exposed in API                        |
| Public API / URL | `UUIDv7` (MariaDB native) | Stored as BINARY(16), no transformer needed |
| Entity Property  | `publicId: string`        | Exposed directly in API (no transformation) |

**CRITICAL RULES:**

- **NEVER** use `parseInt`, `Number()`, or `+` on UUID values.
- **NEVER** use `id ?? ''` fallback for identifiers in the frontend.
- Use `publicId` only in frontend and public API responses.
- `INT id` has `@Exclude()` on the backend — it must never appear in API responses.
