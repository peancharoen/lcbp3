# Session 2026-08-24 - check-real-app Production MCP Workflow

## Summary

ปรับสกิล `check-real-app` ให้ตรวจ deployed application ที่ `https://lcbp3.np-dms.work/` ผ่าน MCP Playwright เป็นเส้นทางหลัก พร้อมขอบเขตการตรวจ production, หลักฐานจาก browser และ fallback ที่ไม่กล่าวอ้างเกินสิ่งที่ตรวจได้จริง

## ปัญหาที่พบ (Root Cause)

สกิลเดิมเน้นการเริ่ม local dev server, `curl` และการเปิด DevTools แบบ manual โดยไม่มี production URL เริ่มต้นหรือ tool-routing สำหรับ MCP Playwright จึงยังไม่กำหนดวิธีเก็บ screenshot, console, network และ responsive evidence อย่างเป็นระบบ นอกจากนี้ยังไม่มี authorization boundary ที่ชัดเจนสำหรับ flow ที่เปลี่ยนข้อมูล production

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `.agents/skills/check-real-app/SKILL.md` | กำหนด production URL เริ่มต้น, MCP Playwright workflow, desktop/mobile check, authentication safety, mutation authorization และ verification levels |
| `.devin/skills/check-real-app/SKILL.md` | sync เนื้อหาจาก canonical skill ให้ตรงกัน |

## กฎที่ Lock แล้ว

- ใช้ URL ที่ผู้ใช้ระบุก่อน; หากไม่ระบุให้ใช้ `https://lcbp3.np-dms.work/`
- คำขอตรวจแอปอนุญาต read-only inspection เท่านั้น การ create/edit/upload/approve/delete บน production ต้องได้รับ explicit authorization สำหรับ flow นั้น
- Full browser verification ต้องมี browser interaction พร้อม screenshot, console และ network evidence
- เมื่อ MCP Playwright ไม่พร้อม ให้รายงานเป็น HTTP-only verification; ห้ามอ้างว่าได้ตรวจ UI จริง
- ห้ามเปิดเผย credentials, tokens, cookies, authorization headers หรือ session values ในรายงาน

## Verification

- [x] `bash .agents/scripts/bash/audit-skills.sh` - skills ทั้ง 35 รายการ healthy และ version ตรงกัน
- [x] canonical `.agents` และ `.devin` mirror มีเนื้อหาตรงกันด้วย `cmp`
- [x] `git diff --check` ผ่านสำหรับ skill ทั้งสองไฟล์
- [ ] Real-app browser verification - session นี้ไม่มี MCP Playwright `browser_*` tools ถูก expose และไม่ได้เปิดตรวจ production app

## Limitations

Generic Codex `quick_validate.py` ไม่รองรับ frontmatter เฉพาะของ LCBP3 skill pack ได้แก่ `version`, `depends-on` และ `handoffs`; ใช้ project audit เป็น validator หลักและผ่านครบถ้วน ไม่มีการเพิ่ม Decision ID, MCP server หรือ Knowledge Graph entity ใหม่ใน session นี้
