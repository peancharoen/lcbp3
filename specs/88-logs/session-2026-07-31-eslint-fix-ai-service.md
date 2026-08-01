# Session 2026-07-31 #2 — Eslint Fix for ai.service.ts (Pre-commit Hook Blocker)

## Summary

แก้ eslint errors ใน `backend/src/modules/ai/ai.service.ts` ที่ block commit ของ ADR-040 Phase 2 (X-API-Key removal) — `manager.query()` คืน `any` ทำให้ `.map()` และ property access เป็น unsafe ตาม `@typescript-eslint/no-unsafe-*` rules

## ปัญหาที่พบ (Root Cause)

Pre-commit hook (husky + lint-staged) ติด 8 eslint errors ใน `ai.service.ts` บรรทัด 1299-1330:

```
1299:11  error  Unsafe assignment of an `any` value          @typescript-eslint/no-unsafe-assignment
1303:11  error  Unsafe assignment of an `any` value          @typescript-eslint/no-unsafe-assignment
1303:41  error  Unsafe call of an `any` typed value          @typescript-eslint/no-unsafe-call
1303:57  error  Unsafe member access .map on an `any` value  @typescript-eslint/no-unsafe-member-access
1306:11  error  Unsafe assignment of an `any` value          @typescript-eslint/no-unsafe-assignment
1306:47  error  Unsafe call of an `any` typed value          @typescript-eslint/no-unsafe-call
1306:63  error  Unsafe member access .map on an `any` value  @typescript-eslint/no-unsafe-member-access
1314:11  error  Unsafe assignment of an `any` value          @typescript-eslint/no-unsafe-assignment
```

**Root cause:** `manager.query()` ใน TypeORM คืน `Promise<any>` เมื่อใช้ raw SQL query ทำให้:
1. การ assign ผลลัพธ์ให้ variable เป็น `unsafe-assignment`
2. การเรียก `.map()` บนผลลัพธ์เป็น `unsafe-call` + `unsafe-member-access`
3. การ access `.id`, `.file_path` บน element เป็น `unsafe-member-access`

**วิธีที่ลองแล้วไม่ผ่าน:** Cast ด้วย `as Array<{...}>` ใน variable declaration โดยตรง — eslint ยังมองเป็น unsafe เพราะ `await manager.query()` คืน `any` ก่อน cast

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/modules/ai/ai.service.ts` | เพิ่ม intermediate `unknown` variable ก่อน cast เป็น typed array — `const correspondencesRaw: unknown = await manager.query(...)` แล้วค่อย `const correspondences = correspondencesRaw as Array<{...}>` (เดียวกันกับ `attachmentRows`) |

**Pattern ที่ผ่าน eslint:**
```typescript
// ✅ ผ่าน — unknown intermediate + cast
const rowsRaw: unknown = await manager.query(sql, params);
const rows = rowsRaw as Array<{ id: number; ... }>;
const ids = rows.map((r) => r.id);

// ❌ ไม่ผ่าน — direct cast บน await expression
const rows = (await manager.query(sql, params)) as Array<{...}>;
// eslint: Unsafe assignment of an `any` value

// ❌ ไม่ผ่าน — ไม่ cast เลย
const rows = await manager.query(sql, params);
rows.map(...) // eslint: Unsafe call/member access
```

## กฎที่ Lock แล้ว

- **D50:** `manager.query()` raw SQL results ต้องผ่าน `unknown` intermediate ก่อน cast เป็น typed array — ห้าม cast โดยตรงบน `await` expression (eslint `no-unsafe-assignment` จะติด)

## Verification

- [x] `npx eslint src/modules/ai/ai.service.ts` — ผ่าน (0 errors)
- [x] `npx tsc --noEmit` — ผ่าน (0 errors)
- [x] `./2git.sh "241 1.0"` — commit `daa3a14f` push ไป Gitea + GitHub สำเร็จ
