# Branch Naming Convention & Multi-Conversation Workflow

> **Scope:** ใช้เมื่อทำงานบน Devin Desktop หรือ IDE อื่นที่มีหลาย conversation/session พร้อมกัน
> **Updated:** 2026-09-05

---

## 1. Branch Naming Convention

### Pattern

```text
<type>/<topic-or-ticket>-<short-desc>
```

ถ้าไม่มี ticket:

```text
<type>/<short-desc>
```

### Types

| Type | ใช้เมื่อ |
|------|---------|
| `feat` | ฟีเจอร์ใหม่, enhancement |
| `fix` | แก้ bug |
| `refactor` | ปรับโครงสร้างโค้ด ไม่เปลี่ยน behavior |
| `docs` | เอกสาร, memory, spec |
| `chore` | tooling, config, dependency |
| `test` | test/coverage |
| `hotfix` | แก้ด่วนบน production |

### ตัวอย่างชื่อ branch

```text
feat/correspondence-originator-validation
fix/uuid-parseint-comparison
refactor/ai-prompt-types-domain-rename
docs/adr-019-uuid-guideline
chore/tsconfig-baseurl-deprecation
```

### Multi-Conversation / Sub-Branch

ถ้าหลาย conversation ทำงานเดียวกัน แต่แยกย่อย ให้ใช้ sub-branch:

```text
feat/correspondence-originator-validation
  └─ feat/correspondence-originator-validation-legal-check
  └─ feat/correspondence-originator-validation-rbac
```

---

## 2. Workflow สำหรับหลาย Conversation

### ก่อนเริ่ม conversation ใหม่

1. ตรวจ `git status`
2. ถ้ามี uncommitted changes จาก conversation ก่อน → `git add` + `git commit` ทันที
3. หรือ `git stash` ถ้ายังไม่อยาก commit

### สร้าง branch ใหม่

```bash
git checkout -b <type>/<topic>
```

### ขณะทำงาน

- commit ทันทีที่แก้ไข/อัปเดตงานย่อยสำเร็จ ไม่ต้องรอ user สั่ง
- ใช้ commit message format `type(scope): description`

### สลับไป conversation อื่น

```bash
git add .
git commit -m "..."
git checkout <other-branch>
```

### เมื่องานเสร็จ

- ไม่ push/merge เอง
- รายงาน user ว่ามี commit อะไรบน branch ไหน
- รอ user รัน `2git.sh` หรือสั่ง merge

---

## 3. Common Scenarios

### 2 conversation คนละงาน

```text
Conversation A → branch: feat/correspondence-originator
Conversation B → branch: fix/uuid-parseint-bug
```

ทำงานบน branch ของตัวเอง ไม่ conflict

### 2 conversation ทำงานเดียวกัน

```text
Conversation A → branch: feat/correspondence-originator
Conversation B → branch: feat/correspondence-originator (same)
```

อันตราย: อาจมี working tree คนละเวอร์ชัน เมื่อสลับ  **แนะนำ commit ทุกครั้งก่อนสลับ** หรือใช้ sub-branch

### 1 conversation ทำหลายงาน

```text
feat/correspondence-originator
feat/correspondence-originator-test
fix/uuid-comparison-discovered-during-work
```

merge กลับตามลำดับเมื่องานเสร็จ

---

## 4. Safety Checklist ก่อนเปลี่ยน Conversation

- [ ] `git status` สะอาด หรือมีแต่ commit แล้ว
- [ ] อยู่บน branch ถูกต้อง
- [ ] ไม่ได้อยู่บน `main`
- [ ] commit message ถูก format
- [ ] ไม่มี `secret` / `console.log` / `any` / `parseInt` บน UUID ตาม `09-commit-checklist`

---

## 5. Hard Limits (ย้ำจาก AGENTS.md)

- **ห้าม push `main` เอง** — รอ user สั่ง
- **push ใช้ `2git.sh` เท่านั้น** — script จะ squash เป็น 1 commit ก่อน push
- **ห้าม merge PR เอง** — ต้อง user อนุมัติ
