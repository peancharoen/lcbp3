# Session — 2026-08-21 (Skills Folder Rename `.` → `-`)

## Summary

เปลี่ยนชื่อโฟลเดอร์ skills ทั้งหมดที่มี `.` ในชื่อให้ใช้ `-` แทน (เช่น `00-speckit.all` → `00-speckit-all`) และอัปเดตการอ้างอิงทั้งหมดในไฟล์ที่เกี่ยวข้องทั่วทั้ง repo ให้ใช้ชื่อใหม่

## ปัญหาที่พบ (Root Cause)

โฟลเดอร์ skills ใช้ `.` เป็น separator (เช่น `00-speckit.all`, `102-speckit.specify`) ซึ่งไม่สอดคล้องกับ convention ทั่วไปที่ควรใช้ `-` และอาจทำให้สับสนกับ file extension ได้

## การแก้ไข (Fix)

### เปลี่ยนชื่อโฟลเดอร์ (20 โฟลเดอร์ × 2 ตำแหน่ง = 40 ครั้ง)

เปลี่ยนในทั้ง `.devin/skills/` และ `.agents/skills/`:

| เดิม | ใหม่ |
|------|------|
| `00-speckit.all` | `00-speckit-all` |
| `01-speckit.prepare` | `01-speckit-prepare` |
| `101-speckit.constitution` | `101-speckit-constitution` |
| `102-speckit.specify` | `102-speckit-specify` |
| `103-speckit.clarify` | `103-speckit-clarify` |
| `104-speckit.plan` | `104-speckit-plan` |
| `105-speckit.tasks` | `105-speckit-tasks` |
| `106-speckit.analyze` | `106-speckit-analyze` |
| `107-speckit.implement` | `107-speckit-implement` |
| `108-speckit.checker` | `108-speckit-checker` |
| `109-speckit.tester` | `109-speckit-tester` |
| `110-speckit.reviewer` | `110-speckit-reviewer` |
| `111-speckit.validate` | `111-speckit-validate` |
| `112-speckit.security-audit` | `112-speckit-security-audit` |
| `201-speckit.status` | `201-speckit-status` |
| `202-speckit.diff` | `202-speckit-diff` |
| `203-speckit.migrate` | `203-speckit-migrate` |
| `204-speckit.quizme` | `204-speckit-quizme` |
| `205-speckit.checklist` | `205-speckit-checklist` |
| `206-speckit.taskstoissues` | `206-speckit-taskstoissues` |

### อัปเดตการอ้างอิงในไฟล์ (~115 ไฟล์)

อัปเดตไฟล์ทั้งหมดที่อ้างอิงชื่อเก่า ครอบคลุม:

- `SKILL.md` ทุกไฟล์ (self-reference `name:`, `depends-on:`, `handoffs:`)
- `README.md` ใน `.devin/skills/` + `.agents/skills/` + `.agents/`
- `_LCBP3-CONTEXT.md`
- `skills.md`
- templates (`plan-template.md`, `tasks-template.md`, `checklist-template.md`)
- scripts bash/powershell (`sync-workflows.sh`, `check-prerequisites.sh`, `check-prerequisites.ps1`, `common.ps1`)
- tests (`workflow-validation.test.js`, `skill-integration.test.js`)
- specs หลายไฟล์ใน `specs/200-fullstacks/`, `specs/100-Infrastructures/`, `specs/88-logs/`
- `CONTRIBUTING.md`, `README.md` (root)
- `memory/project-memory-override.md`
- `dms-analysis.txt` (8MB tracked analysis snapshot)
- เปลี่ยนชื่อไฟล์ archive ใน `specs/99-archives/old-workflows-wrapper/` (20 ไฟล์) ให้ใช้ `-` ด้วย

### เทคนิคสำคัญ

จัดลำดับ sed rules จาก pattern ที่ยาวก่อน (`speckit.taskstoissues` ก่อน `speckit.tasks`) เพื่อป้องกัน substring mismatch — ถ้าสั่ง `speckit.tasks` ก่อน จะจับ `speckit.taskstoissues` ผิดเป็น `speckit-tasksstoissues` หรือทำให้เกิดการแทนที่ซ้อน

## กฎที่ Lock แล้ว

- **Skill folder naming convention**: ใช้ `-` เป็น separator เท่านั้น ห้ามใช้ `.` ในชื่อโฟลเดอร์ skill (เช่น `00-speckit-all` ไม่ใช่ `00-speckit.all`)
- เมื่อเพิ่ม skill ใหม่ ให้ตั้งชื่อโฟลเดอร์ด้วย `-` และอ้างอิงใน `SKILL.md` (`name:`, `depends-on:`, `handoffs:`) ด้วยชื่อเดียวกัน
- ทั้ง `.devin/skills/` และ `.agents/skills/` ต้อง sync ชื่อโฟลเดอร์เหมือนกันเสมอ

## Verification

- [x] `grep -rE 'speckit\.(all|prepare|...|taskstoissues)'` ทั่ว repo (ยกเว้น `.git`) = 0 matches
- [x] ไม่มีโฟลเดอร์ที่มี `.` เหลือใน `.devin/skills/` และ `.agents/skills/`
- [x] self-reference ใน `SKILL.md` (`name:`, `depends-on:`, `handoffs:`) สอดคล้องกับชื่อโฟลเดอร์ใหม่
- [x] ไฟล์ archive ใน `specs/99-archives/old-workflows-wrapper/` เปลี่ยนชื่อครบ
- [ ] **Commit + push via 2git.sh** — pending (ยังไม่ได้ commit)
- [ ] **ทดสอบ skill invocation** — ลองเรียก skill ผ่าน `skill` tool หลัง rename เพื่อยืนยันว่า skill registry ยัง resolve ชื่อใหม่ได้
