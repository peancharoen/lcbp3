# Branch Naming Convention & Multi-Conversation Workflow

> **Scope:** ใช้เมื่อทำงานบน Devin Desktop หรือ IDE อื่นที่มีหลาย conversation/session พร้อมกัน
> **Updated:** 2026-09-10 (เพิ่ม Git Worktree Architecture + ปรับ Workflow ให้ใช้ worktree แทน checkout)

---

## 0. Git Worktree Architecture (หัวใจสำคัญ)

แทนที่จะให้ทุก conversation รันใน working directory เดียวกัน ให้ใช้ **Git Worktree** ซึ่งช่วยให้แต่ละ conversation มี Working Tree, HEAD, Index และ Staging Area แยกขาดจากกันโดยสิ้นเชิง โดยยังแชร์ `.git` database เดียวกัน (ประหยัดพื้นที่ดิสก์ ไม่ต้อง clone ใหม่)

### โครงสร้าง Directory

```text
/opt/np-dms-lcbp3/                      # PRIMARY worktree — อยู่บน main เสมอ
└── .git/                                # shared object database (single source of truth)

/opt/np-dms-wt/                          # worktree root (sibling ของ primary)
├── 253-unified-doc-crud-complete/        # worktree ต่อ branch
├── 255-rag-admin-console/
├── 256-new-feature/                     # branch ใหม่จาก main
├── 256-new-feature-rbac/                # sub-branch = parent-slug + descriptor (flat)
└── fix-uuid-parseint-bug/
```

### หลักการตั้งชื่อ Folder

- **Flat naming** — แทน `/` ใน branch name ด้วย `-` เช่น `feat/correspondence` → `feat-correspondence`
- **ห้าม leading dash** — ชื่อ folder ขึ้นต้นด้วย `-` ทำให้ shell command (`cd`, `rm`, `ls`) ตีความผิดเป็น option
- **Folder name == branch slug** — ใช้ `worktree add /opt/np-dms-wt/<slug> <branch>` ได้โดยตรง

### Primary Worktree Discipline

- **Primary (`/opt/np-dms-lcbp3`) อยู่บน `main` เสมอ** — เป็นจุดอ้างอิงสะอาดสำหรับ `2git.sh` และ CI baseline
- ห้ามทำงาน feature บน primary — ใช้ `wt-add.sh` สร้าง worktree ใหม่เสมอ
- ถ้า primary ติดอยู่บน branch อื่น → ย้าย branch นั้นไป worktree ก่อน แล้วคืน primary สู่ `main`

### Bootstrap Script

ใช้ `scripts/wt-add.sh` สำหรับสร้าง worktree ใหม่ในคำสั่งเดียว (worktree add + .env + pnpm install):

```bash
# สร้าง branch ใหม่จาก main
./scripts/wt-add.sh 256-new-feature

# เชื่อม branch ที่มีอยู่แล้ว
./scripts/wt-add.sh 253-unified-doc-crud-complete

# สร้าง sub-branch จาก base อื่น
./scripts/wt-add.sh 256-new-feature-rbac 256-new-feature
```

### การจัดการ .env (Untracked Files)

Git Worktree checkout เฉพาะไฟล์ใน Git Index ดังนั้น `.env` (gitignored) ไม่ตามมาอัตโนมัติ:

| ไฟล์            | วิธี provisioning           | เหตุผล                                           |
| --------------- | --------------------------- | ------------------------------------------------ |
| `frontend/.env` | **symlink** จาก primary     | ไฟล์จริงอยู่ที่ primary ใช้ร่วมกันได้            |
| `backend/.env`  | **copy** จาก `.env.example` | primary ไม่มี `.env` จริง (มีแค่ `.env.example`) |

**Caveats:**

- **Shared env = shared assumptions** — ถ้า 2 conversation ต้องการ config คนละแบบ (เช่น `DATABASE_URL` คนละค่า) ต้องแก้ symlink เป็น copy เอง
- **Primary moved/removed → broken symlinks** — ถ้าลบ primary worktree ทุก symlink จะพัง (ความเสี่ยงต่ำ แต่ควรระวัง)

### การจัดการ node_modules ด้วย pnpm

pnpm ใช้ **content-addressable store** (`/home/np-dms/.local/share/pnpm/store/v11`) — `pnpm install` ใน worktree ใหม่สร้าง **hard link** จาก store กลาง ใช้เวลาไม่กี่วินาที และไม่กินพื้นที่ดิสก์ซ้ำซ้อน

**สำคัญ:** รัน `pnpm install` ที่ **workspace root** ของ worktree (ไม่ใช่ per-package) เพื่อให้ `patches/@nestjs__swagger.patch` และ `overrides` ใน `pnpm-workspace.yaml` มีผล — `--frozen-lockfile` เพื่อให้ตรงกับ CI

### คำสั่ง Worktree หลัก

```bash
# สร้าง worktree + branch ใหม่จาก main
git -C /opt/np-dms-lcbp3 worktree add -b 256-new-feature /opt/np-dms-wt/256-new-feature main

# สร้าง worktree สำหรับ branch ที่มีอยู่
git -C /opt/np-dms-lcbp3 worktree add /opt/np-dms-wt/253-unified-doc-crud-complete 253-unified-doc-crud-complete

# สร้าง sub-branch
git -C /opt/np-dms-lcbp3 worktree add -b 256-new-feature-rbac /opt/np-dms-wt/256-new-feature-rbac 256-new-feature

# ดู worktree ทั้งหมด
git -C /opt/np-dms-lcbp3 worktree list

# ลบ worktree เมื่อ branch ทำเสร็จและ merge แล้ว
git -C /opt/np-dms-lcbp3 worktree remove /opt/np-dms-wt/256-new-feature
git -C /opt/np-dms-lcbp3 worktree prune
```

---

## 1. Branch Naming Convention

### Pattern

```text
<ticket>-<short-desc>
```

ถ้าไม่มี ticket:

```text
<type>/<short-desc>
```

### Types (ใช้เมื่อไม่มี ticket)

| Type       | ใช้เมื่อ                              |
| ---------- | ------------------------------------- |
| `feat`     | ฟีเจอร์ใหม่, enhancement              |
| `fix`      | แก้ bug                               |
| `refactor` | ปรับโครงสร้างโค้ด ไม่เปลี่ยน behavior |
| `docs`     | เอกสาร, memory, spec                  |
| `chore`    | tooling, config, dependency           |
| `test`     | test/coverage                         |
| `hotfix`   | แก้ด่วนบน production                  |

### ตัวอย่างชื่อ branch

```text
253-unified-doc-crud-complete
255-rag-admin-console
feat/correspondence-originator-validation
fix/uuid-parseint-comparison
docs/adr-019-uuid-guideline
```

### Sub-Branch (แยกย่อยในงานเดียวกัน)

```text
253-unified-doc-crud-complete
  └─ 253-unified-doc-crud-complete-rbac
  └─ 253-unified-doc-crud-complete-legal-check
```

---

## 2. Workflow สำหรับหลาย Conversation (Worktree-based)

### เริ่ม conversation ใหม่

```bash
# สร้าง worktree ใหม่ (worktree add + .env + pnpm install ในคำสั่งเดียว)
./scripts/wt-add.sh <branch> [base]

# เข้าไปทำงาน
cd /opt/np-dms-wt/<branch-slug>
```

ไม่ต้องตรวจ `git status` หรือ commit/stash ก่อนเริ่ม — แต่ละ worktree แยกขาดจากกัน

### ขณะทำงาน

- commit ทันทีที่แก้ไข/อัปเดตงานย่อยสำเร็จ ไม่ต้องรอ user สั่ง
- ใช้ commit message format `type(scope): description`

### สลับไป conversation อื่น

```bash
# ไม่ต้อง checkout — แค่ cd ไป worktree ของ conversation นั้น
cd /opt/np-dms-wt/<other-branch-slug>
```

ไม่ต้อง commit/stash ก่อนสลับ เพราะแต่ละ worktree มี working tree ของตัวเอง

### เมื่องานเสร็จ

- ไม่ push/merge เอง
- รายงาน user ว่ามี commit อะไรบน branch ไหน
- รอ user รัน `2git.sh` หรือสั่ง merge
- เมื่อ merge เสร็จ ลบ worktree: `git worktree remove /opt/np-dms-wt/<slug>`

---

## 3. Common Scenarios

### 2 conversation คนละงาน

```text
Conversation A → worktree: /opt/np-dms-wt/256-feature-a (branch: 256-feature-a)
Conversation B → worktree: /opt/np-dms-wt/257-fix-b      (branch: 257-fix-b)
```

ทำงานบน worktree ของตัวเอง ไม่ conflict ไม่ต้องสลับ branch

### 2 conversation ทำงานเดียวกัน (branch เดียวกัน)

```text
Conversation A → worktree: /opt/np-dms-wt/256-feature-a (branch: 256-feature-a)
Conversation B → พยายามสร้าง worktree บน branch เดียวกัน
```

**Git ป้องกันเอง** — ไม่สามารถ checkout branch เดียวกันใน 2 worktree ได้ (structurally impossible) ให้ใช้ sub-branch แทน:

```text
Conversation A → /opt/np-dms-wt/256-feature-a           (branch: 256-feature-a)
Conversation B → /opt/np-dms-wt/256-feature-a-rbac       (branch: 256-feature-a-rbac)
```

### 1 conversation ทำหลายงาน

```text
/opt/np-dms-wt/256-feature-a
/opt/np-dms-wt/256-feature-a-test
/opt/np-dms-wt/fix-uuid-discovered-during-work
```

merge กลับตามลำดับเมื่องานเสร็จ

---

## 4. Safety Checklist ก่อนเปลี่ยน Conversation

- [ ] อยู่บน worktree ที่ถูกต้อง (`pwd` ขึ้นต้นด้วย `/opt/np-dms-wt/`)
- [ ] ไม่ได้อยู่บน primary (`/opt/np-dms-lcbp3`) — primary สำหรับ `main` เท่านั้น
- [ ] commit แล้วทุกงานย่อยที่เสร็จ (ตาม D264 — ไม่ปล่อย uncommitted ค้างข้ามงาน)
- [ ] commit message ถูก format (`type(scope): description`)
- [ ] ไม่มี `secret` / `console.log` / `any` / `parseInt` บน UUID ตาม `09-commit-checklist`

---

## 5. Hard Limits (ย้ำจาก AGENTS.md)

- **ห้าม push `main` เอง** — รอ user สั่ง
- **push ใช้ `2git.sh` เท่านั้น** — script จะ squash เป็น 1 commit ก่อน push
- **ห้าม merge PR เอง** — ต้อง user อนุมัติ
- **primary worktree อยู่บน `main` เท่านั้น** — ห้ามทำ feature บน primary
