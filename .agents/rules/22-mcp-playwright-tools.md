# MCP Playwright Tools

MCP Playwright server (`devin/mcp-playwright`) ให้เครื่องมือสำหรับควบคุม browser แบบ headless ใช้สำหรับ:

- E2E testing และ real-app verification (คู่กับ `check-real-app` skill)
- ตรวจสอบ UI หลัง build pass — ยืนยันว่าทำงานใน environment จริง
- Debug frontend issues ผ่าน console messages, network requests, screenshots
- ทดสอบ user flows (login, form submit, navigation)

## Available Tools

### Navigation & Page

| Tool                     | หน้าที่                              |
| ------------------------ | ------------------------------------ |
| `browser_navigate`        | ไปที่ URL                           |
| `browser_navigate_back`  | กลับหน้าก่อนหน้า                    |
| `browser_close`           | ปิด page                            |
| `browser_resize`          | ปรับขนาดหน้าต่าง (width, height)    |
| `browser_tabs`            | จัดการ browser tabs                 |
| `browser_wait_for`         | รอเงื่อนไข (text, timeout, ฯลฯ)     |

### Interaction

| Tool                     | หน้าที่                              |
| ------------------------ | ------------------------------------ |
| `browser_click`           | คลิก element                        |
| `browser_type`            | พิมพ์ข้อความใน element              |
| `browser_fill_form`       | กรอก form หลาย fields พร้อมกัน     |
| `browser_press_key`       | กด key (เช่น Enter, Escape)         |
| `browser_select_option`   | เลือก option ใน `<select>`           |
| `browser_hover`            | hover element                       |
| `browser_drag`             | drag element ไปยัง target           |
| `browser_drop`             | drop files/data ลง element          |
| `browser_file_upload`      | upload files                        |
| `browser_handle_dialog`    | จัดการ alert/confirm/prompt dialog  |

### Inspection & Capture

| Tool                       | หน้าที่                              |
| -------------------------- | ------------------------------------ |
| `browser_snapshot`          | ถ่าย accessibility snapshot ของหน้า |
| `browser_find`              | ค้นหา text/regex ใน snapshot         |
| `browser_take_screenshot`   | ถ่ายภาพหน้าจอ                       |
| `browser_console_messages`  | อ่าน console messages (error/warn/info/debug) |
| `browser_network_requests`  | แสดง network requests ทั้งหมด       |
| `browser_network_request`   | ดูรายละเอียด request เดียว         |

### Advanced

| Tool                     | หน้าที่                              |
| ------------------------ | ------------------------------------ |
| `browser_evaluate`        | รัน JavaScript ใน page             |
| `browser_run_code_unsafe` | รัน code block (unsafe — ระวัง!)    |

## การใช้งานร่วมกับ Development Flow

**เมื่อ verify real app (คู่กับ `check-real-app` skill):**

1. ใช้ `browser_navigate` ไปที่ URL ของแอป
2. ใช้ `browser_snapshot` เพื่อดู accessibility tree
3. ใช้ `browser_find` เพื่อหา element ที่สนใจ
4. ใช้ `browser_click` / `browser_fill_form` เพื่อทดสอบ user flow
5. ใช้ `browser_console_messages({ level: 'error' })` เพื่อตรวจสอบ errors
6. ใช้ `browser_take_screenshot` เพื่อบันทึกหลักฐาน

**เมื่อ debug frontend issues:**

1. ใช้ `browser_navigate` ไปหน้าที่มีปัญหา
2. ใช้ `browser_console_messages({ level: 'warning' })` เพื่อดู warnings + errors
3. ใช้ `browser_network_requests` เพื่อตรวจสอบ API calls ที่ fail
4. ใช้ `browser_evaluate` เพื่อ inspect state (เช่น localStorage, React state)
5. ใช้ `browser_take_screenshot` เพื่อดู visual state

**เมื่อทดสอบ user flow:**

1. ใช้ `browser_navigate` ไปหน้าเริ่มต้น
2. ใช้ `browser_fill_form` กรอก form หลาย fields
3. ใช้ `browser_click` กด submit
4. ใช้ `browser_wait_for` รอผลลัพธ์
5. ใช้ `browser_snapshot` ยืนยันผลลัพธ์

## ข้อควรระวัง

- **🔴 ห้ามใช้ `browser_run_code_unsafe` โดยไม่จำเป็น** — รัน code โดยไม่มี sandbox ใดๆ
- **⚠️ ระวัง `browser_evaluate` บน production URL** — อาจกระทบ state ของ user จริง
- **⚠️ ระวัง `browser_file_upload` บน production** — อาจ upload ไฟล์จริงเข้าระบบ
- **✅ ใช้ `browser_snapshot` + `browser_find` แทนการ guess selector** — ใช้ ref จาก snapshot
- **✅ ใช้ `browser_console_messages({ all: true })`** เพื่อดู messages ตั้งแต่ต้น session
- **✅ ใช้ `browser_wait_for` แทน `sleep`** — รอเงื่อนไขแทนการรอเวลาตายตัว
- **⚠️ ปิด browser เมื่อใช้เสร็จ** — ใช้ `browser_close` เพื่อคืน resource
- **✅ ใช้คู่กับ `e2e-testing` skill** สำหรับ Page Object Model patterns

## Related Documents

- `.devin/skills/check-real-app/SKILL.md` — Manual real-app verification workflow
- `.devin/skills/e2e-testing/SKILL.md` — Playwright E2E patterns, POM, CI/CD integration
- `specs/05-Engineering-Guidelines/05-04-testing-strategy.md` — Testing strategy
