// File: frontend/__tests__/README.md
// Change Log
// - 2026-06-13: Document frontend unit test naming and header conventions.

# Frontend Test Conventions

ใช้ไฟล์ `*.test.ts` หรือ `*.test.tsx` เท่านั้น เพราะ `frontend/vitest.config.ts` include pattern รองรับชื่อนี้

ทุก test file ต้องขึ้นต้นด้วย:

```ts
// File: frontend/path/to/file.test.ts
// Change Log
// - YYYY-MM-DD: คำอธิบายการเปลี่ยนแปลง
```

แนวทางหลัก:

- ใช้ `createTestQueryClient()` จาก `@/lib/test-utils` สำหรับ hook/component ที่ใช้ TanStack Query
- Mock HTTP ผ่าน `apiClient` ที่ตั้งค่าไว้ใน `vitest.setup.ts`
- Mock data ฝั่ง Public API ต้องใช้ `publicId` เป็น UUIDv7 ตาม ADR-019
- ห้ามใช้ `console.log` ใน test
- หลีกเลี่ยง `any`; ถ้าจำเป็นต้อง mock shape บางส่วน ให้ใช้ `Partial<T>` หรือ type เฉพาะของ test
