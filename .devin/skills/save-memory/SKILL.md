---
name: save-memory
description: บันทึก session log และอัปเดต project memory ตามโครงสร้างใหม่
version: 1.9.0
scope: project-management
depends-on: []
user-invocable: true
---

# บันทึก Memory (Save Memory)

Skill นี้ใช้สำหรับบันทึก session log และอัปเดต project memory ตามโครงสร้างใหม่ที่ reorganization แล้ว

## โครงสร้าง Memory ใหม่

```
memory/
├── README.md (index + overview)
├── mcp-tools.md (MCP MariaDB + Memory Tools)
└── project-memory-override.md (OS rules, Current Decisions, Environment, Next Session Focus)

specs/88-logs/
├── rollouts.md (Recent rollouts table)
└── session-YYYY-MM-DD-[topic].md (Session logs)
```

## ขั้นตอนการบันทึก Memory

### 1. สร้าง Session Log (ถ้ามีงาน session ใหม่)

เมื่อทำงาน session ใหม่ให้:

1. **สร้างไฟล์ session log ใหม่** ใน `specs/88-logs/`
   - ชื่อไฟล์: `session-YYYY-MM-DD-[topic].md`
   - ตัวอย่าง: `session-2026-06-07-memory-reorganization.md`

2. **บันทึกเนื้อหาใน session log**:

   ```markdown
   # Session [N] — YYYY-MM-DD ([Topic])

   ## Summary

   [สรุปสิ่งที่ทำใน session นี้]

   ## ปัญหาที่พบ (Root Cause)

   [อธิบายปัญหาและสาเหตุ]

   ## การแก้ไข (Fix)

   | ไฟล์           | การเปลี่ยนแปลง         |
   | -------------- | ---------------------- |
   | [path/to/file] | [อธิบายการเปลี่ยนแปลง] |

   ## กฎที่ Lock แล้ว

   [บันทึก pattern หรือ decision ที่ตกลง]

   ## Verification

   [วิธีตรวจสอบว่างานสำเร็จ]
   ```

3. **อัปเดต `specs/88-logs/rollouts.md`**
   - เพิ่ม entry ใหม่ในตาราง Recent Rollouts
   - รูปแบบ: `| วันที่ | Version | รายการ | สถานะ |`

### 2. อัปเดต Project Memory (ถ้ามี decision ใหม่)

เมื่อมีการตัดสินใจสำคัญใหม่ให้:

1. **เปิดไฟล์ `memory/project-memory-override.md`**

2. **อัปเดตตาราง "Current Decisions (Locked)"**
   - เพิ่ม entry ใหม่ถ้ามี decision ใหม่
   - รูปแบบ: `| ID | Decision | ADR |`

3. **อัปเดต "Next Session Focus"**
   - เพิ่มงานใหม่ถ้ามี
   - ทำเครื่องหมาย `[ ]` สำหรับงานที่ยังไม่เสร็จ
   - ทำเครื่องหมาย `[X]` สำหรับงานที่เสร็จแล้ว

4. **อัปเดต "Environment & Services"** (ถ้ามีการเปลี่ยนแปลง)
   - อัปเดต URL, port, หรือ notes ถ้ามีการเปลี่ยน infrastructure

### 3. อัปเดต MCP Tools (ถ้ามี tools ใหม่)

เมื่อมี MCP tools ใหม่ให้:

1. **เปิดไฟล์ `memory/mcp-tools.md`**

2. **เพิ่ม tool ใหม่ในตาราง "Available Tools"**
   - รูปแบบ: `| Tool | Purpose | Example Usage |`

3. **เพิ่ม usage example และ warnings** ถ้าจำเป็น

### 4. อัปเดต Root Documentation (ถ้ามีการเปลี่ยนแปลง)

เมื่อมีการเปลี่ยนแปลงที่ส่งผลต่อเอกสารระดับ root ให้:

1. **ARCHITECTURE.md** — อัปเดตเมื่อ:
   - เปลี่ยน architecture หลัก
   - เพิ่ม/ลบ component สำคัญ
   - เปลี่ยน data flow หรือ integration pattern

2. **CHANGELOG.md** — อัปเดตเมื่อ:
   - Deploy version ใหม่
   - เพิ่ม feature หรือ breaking change สำคัญ
   - รูปแบบ: `## [version] (YYYY-MM-DD)` → `### feat(scope): description`

3. **CONTEXT.md** — อัปเดตเมื่อ:
   - เปลี่ยน domain terminology หลัก
   - เพิ่ม concept ใหม่ที่ใช้ทั่ว project
   - อัปเดต glossary หรือ business rules

4. **CONTRIBUTING.md** — อัปเดตเมื่อ:
   - เปลี่ยน workflow การทำงาน
   - เพิ่ม/เปลี่ยน coding standards
   - อัปเดต CI/CD process

5. **README.md** — อัปเดตเมื่อ:
   - เปลี่ยน project structure
   - เพิ่ม/เปลี่ยน installation steps
   - อัปเดต feature overview หรือ tech stack

## Template สำหรับ Session Log

```markdown
# Session [N] — YYYY-MM-DD ([Topic])

## Summary

[สรุปสิ่งที่ทำใน session นี้ใน 1-2 ประโยค]

## ปัญหาที่พบ (Root Cause)

[อธิบายปัญหาและสาเหตุหลัก]

## การแก้ไข (Fix)

| ไฟล์           | การเปลี่ยนแปลง         |
| -------------- | ---------------------- |
| `path/to/file` | [อธิบายการเปลี่ยนแปลง] |

## กฎที่ Lock แล้ว

[บันทึก pattern หรือ decision ที่ตกลงและไม่ควรเปลี่ยน]

## Verification

- [ ] [check 1]
- [ ] [check 2]
```

## ข้อควรระวัง

- **ห้าม** บันทึก rules ที่ซ้ำกับ specs/ (ADRs, glossary, guidelines)
- **ห้าม** บันทึก commands ที่ซ้ำกับ specs/05-Engineering-Guidelines/
- **ห้าม** บันทึก environment ที่ซ้ำกับ specs/04-Infrastructure-OPS/
- **ใช้** `specs/88-logs/` สำหรับ session history และ rollouts
- **ใช้** `memory/project-memory-override.md` สำหรับ OS rules, decisions, environment ที่ไม่มีใน specs
- **ใช้** `memory/mcp-tools.md` สำหรับ MCP tools documentation
- **อัปเดต Root Documentation** (ARCHITECTURE.md, CHANGELOG.md, CONTEXT.md, CONTRIBUTING.md, README.md) เฉพาะเมื่อมีการเปลี่ยนแปลงที่ส่งผลต่อ project architecture, version, terminology, workflow หรือ structure

## ตัวอย่างการใช้งาน

### กรณีที่ 1: ทำงาน session ใหม่

```
1. สร้างไฟล์ specs/88-logs/session-2026-06-07-bug-fix.md
2. บันทึกปัญหา, การแก้ไข, verification
3. อัปเดต specs/88-logs/rollouts.md
```

### กรณีที่ 2: มี decision ใหม่

```
1. เปิด memory/project-memory-override.md
2. เพิ่ม entry ใหม่ในตาราง Current Decisions
3. อัปเดต Next Session Focus
```

### กรณีที่ 3: เปลี่ยน infrastructure

```
1. เปิด memory/project-memory-override.md
2. อัปเดตตาราง Environment & Services
3. อัปเดต Key Environment Variables ถ้าจำเป็น
```

### กรณีที่ 4: อัปเดต Root Documentation

```
1. ตรวจสอบว่ามีการเปลี่ยนแปลงที่ส่งผลต่อ ARCHITECTURE.md, CHANGELOG.md, CONTEXT.md, CONTRIBUTING.md, หรือ README.md
2. อัปเดตไฟล์ที่เกี่ยวข้องตามรูปแบบที่กำหนด
3. ตรวจสอบว่าการเปลี่ยนแปลงสอดคล้องกับ specs/ และ ADRs
```
