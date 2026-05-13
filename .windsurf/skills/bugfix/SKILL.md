// File: .agents/skills/bugfix/SKILL.md
// Change Log: 2026-05-13 - Initial version improved from docs/bugfix.md

---
name: bugfix
description: Quick bugfix workflow with minimal impact. Focused on surgical fixes without unrelated refactoring.
version: 1.0.0
---

# Bugfix

ใช้สำหรับแก้ไข Bug ที่ระบุสาเหตุได้ชัดเจน โดยเน้นที่การแก้ไขที่ตรงจุด (Surgical Fix) และมีผลกระทบน้อยที่สุด (Minimal Impact)

## Phase 1 — Analysis (การวิเคราะห์)

1. **Read Logs & Context**: อ่าน Error Logs หรือรายละเอียดที่ User แจ้งมาให้ครบถ้วน
2. **Identify Root Cause**: ค้นหาสาเหตุที่แท้จริง (Root Cause) ไม่ใช่แค่การแก้ที่ปลายเหตุ
3. **Check Error Catalog**: ตรวจสอบ `docs/error-catalog.md` เพื่อดูว่ามี Error Code หรือ Pattern ที่เกี่ยวข้องหรือไม่
4. **Locate Code**: ระบุไฟล์และบรรทัดที่เกิดปัญหาให้ชัดเจน

## Phase 2 — Planning (การวางแผน)

1. **Create Fix Plan**: ร่างแผนการแก้ไขที่เน้น **Minimal Change**
   - ห้าม Refactor โค้ดที่ไม่เกี่ยวข้อง
   - หลีกเลี่ยงการเปลี่ยนแปลงที่จะส่งผลกระทบต่อส่วนอื่น (No Side Effects)
2. **Verify Standards**: ตรวจสอบว่าแผนการแก้ไขไม่ขัดกับ Tier 1 (Security, UUID, DB) และ Tier 2 (Architecture) ใน `AGENTS.md`
3. **Save to fix.md**: (Optional) บันทึกรายละเอียดการแก้ไขลงในไฟล์ `fix.md` เพื่อใช้ตรวจสอบก่อนลงมือจริง

## Phase 3 — Execution (การดำเนินการ)

1. **Apply Fix**: ลงมือแก้ไขโค้ดตามแผน
2. **Verify Fix**: 
   - จำลองสถานการณ์เพื่อยืนยันว่า Bug หายไปจริง
   - ตรวจสอบว่าไม่มี Forbidden Patterns (`any`, `console.log`, UUID misuse)
3. **Regression Check**: ตรวจสอบส่วนที่เกี่ยวข้องว่ายังทำงานได้ปกติ

## Phase 4 — Finalization (การสรุปผล)

1. **Report**: สรุปผลการแก้ไขให้ User ทราบ
   - Root cause (สาเหตุ)
   - Fix detail (รายละเอียดการแก้)
   - Affected files (ไฟล์ที่เกี่ยวข้อง)
2. **Cleanup**: ลบไฟล์ `fix.md` หรือ Debug logs ที่สร้างขึ้น
