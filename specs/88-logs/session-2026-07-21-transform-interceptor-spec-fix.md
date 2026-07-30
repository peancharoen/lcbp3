# Session — 2026-07-21 (TransformInterceptor Spec TypeScript Fix)

## Summary

แก้ TypeScript errors 16 ตัวใน `transform.interceptor.spec.ts` ที่บล็อก `2git.sh` commit (husky pre-commit failed)

## ปัญหาที่พบ (Root Cause)

`TransformInterceptor<T>` มี return type `Observable<ApiResponse<T> | T>` เมื่อ `T = unknown` แล้ว `lastValueFrom()` จะ resolve เป็น `unknown` — การเข้าถึง property เช่น `result.statusCode`, `result.data`, `result.meta` บน `unknown` ทำให้เกิด `TS18046: 'result' is of type 'unknown'`

นอกจากนี้ยังมี `TS2322: Type 'unknown' is not assignable to type 'ApiResponse<unknown>'` ใน 2 test ที่ประกาศ `const result: ApiResponse<unknown> = await lastValueFrom(...)`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/common/interceptors/transform.interceptor.spec.ts` | Cast ผลลัพธ์ `lastValueFrom()` ทั้ง 16 จุด เป็น `ApiResponse<unknown>` ด้วย `as ApiResponse<unknown>` |

## กฎที่ Lock แล้ว

- Test spec ที่เรียก `interceptor.intercept()` ต้อง cast ผลลัพธ์ `lastValueFrom` เป็น `ApiResponse<unknown>` เสมอ เพราะ return type ของ `intercept()` เป็น union `ApiResponse<T> | T`

## Verification

- [x] `npx tsc --noEmit --pretty src/common/interceptors/transform.interceptor.spec.ts` — exit 0, no errors
- [ ] `2git.sh "New Server 90%"` commit สำเร็จ (pending user re-run)
