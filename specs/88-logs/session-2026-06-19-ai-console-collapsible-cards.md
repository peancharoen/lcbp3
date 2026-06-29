# Session — 2026-06-19 (AI Console Collapsible Cards)

## Summary

เพิ่มปุ่มและฟังก์ชันพับ/คลี่การ์ดและเซกชัน (Collapsible Cards and Sections) ในหน้า AI Admin Console (`/admin/ai`) ตามดีไซน์ "AI Console with Fixed Collapsible Cards" จาก Stitch (Project ID: `6165107555700812297`, Screen name `30ce3255a7444cc99e4009fa303d948c`) เพื่อเพิ่มความสะดวกในการใช้งานของผู้ดูแลระบบ และบันทึกสถานะล่าสุดลงใน `localStorage` เพื่อรักษาสถานะเมื่อหน้าจอรีเฟรช

## ปัญหาที่พบ (Root Cause)

หน้า AI Admin Console (`/admin/ai`) มีข้อมูลแสดงสถานะและประสิทธิภาพการทำงานจำนวนมาก (Ollama, Qdrant, OCR Sidecar, BullMQ queues, และ GPU VRAM Monitor) ซึ่งเมื่อแสดงพร้อมกันทั้งหมดในหน้าจอเดียว ทำให้หน้าจอค่อนข้างยาวและยากต่อการจดจ่อเฉพาะข้อมูลที่สนใจ นอกจากนี้ระบบเดิมยังไม่มีความสามารถในการพับเก็บหรือคงสถานะพับเก็บหลังการรีเฟรชหน้าจอ

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ----- | ------------------ |
| `frontend/app/(admin)/admin/ai/page.tsx` | - เพิ่ม state `isSectionCollapsed` (สำหรับพับเซกชัน Monitoring ทั้งหมด) และ `collapsedCards` (สำหรับพับการ์ดแต่ละใบ: ollama, qdrant, ocr, queues, vram)<br>- เพิ่ม `useEffect` เพื่อโหลดสถานะเริ่มต้นจาก `localStorage` เมื่อหน้าจอโหลดเสร็จ เพื่อป้องกัน Hydration Mismatch ใน SSR<br>- เพิ่ม chevron-toggle button พร้อม transition animation (หมุน chevron 180 องศา) ในส่วนหัวของหน้าและหัวของการ์ดแต่ละใบ<br>- เพิ่มการห่อหุ้ม `CardContent` ใน div ที่กำหนด CSS transition (`max-h-0 opacity-0 overflow-hidden` / `max-h-[500px]` หรือ `max-h-[2000px]`) สำหรับ animation ที่นุ่มนวล โดยไม่มีผลกระทบต่อ TanStack Query background polling |

## กฎที่ Lock แล้ว

- **สถานะพับเก็บการ์ดและเซกชัน (Collapsible State)** จะต้องเก็บลงใน `localStorage` ของเบราว์เซอร์ เพื่อให้คงสถานะข้ามการรีเฟรชและการสลับแท็บ
- **การใช้ transition CSS ใน Next.js (SSR)** จะต้องระมัดระวังเรื่อง Hydration Mismatch โดยการเรียกโหลดสถานะจาก `localStorage` ภายใน `useEffect` เท่านั้น
- **Background Polling** (TanStack Query) จะต้องทำงานอย่างต่อเนื่องในพื้นหลัง ไม่ว่าการ์ดหรือเซกชันนั้นจะอยู่ในสถานะพับหรือคลี่

## Verification

- [x] ตรวจสอบสิทธิ์และโครงสร้าง (CASL / RBAC) - หน้า /admin/ai ยังทำงานภายใต้ CASL Guard ตามปกติ
- [x] ตรวจสอบ `tsc --noEmit` ของฝั่ง frontend - ผ่าน (Exit code 0)
- [x] ตรวจสอบ `pnpm eslint` ของฝั่ง frontend - ผ่าน (Exit code 0)
- [x] สร้างรายงานผลตรวจสอบความถูกต้องและบันทึกใน `specs/200-fullstacks/240-ai-console-collapsible-cards/validation-report.md`
