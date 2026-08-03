# Session — 2026-08-03 (Specs Drift Cleanup — Phase 3 + Phase 4 + Phase 5 + QNAP archive)

## Summary

ต่อจาก [Phase 1+2](./session-2026-08-03-specs-drift-cleanup-phase1-2.md) — ทำ Phase 3-5 ของแผน specs drift cleanup พร้อมเพิ่มเติม: ย้าย `04-00-docker-compose/QNAP/` ทั้งโฟลเดอร์ไป archive ตามข้อเท็จจริงที่ผู้ใช้ยืนยันว่า QNAP ไม่รัน Docker อีกต่อไป

## การเปลี่ยนแปลง

### Phase 2.6 (เพิ่มเติมจากผู้ใช้) — ย้าย QNAP stack ไป archive

ผู้ใช้ยืนยัน: "QNAP จริงไม่มี docker เหลืออีกแล้ว ย้ายไป 99-archives ได้เลย"

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `04-00-docker-compose/QNAP/` → `99-archives/04-00-docker-compose-QNAP/` | ย้ายทั้งโฟลเดอร์ (21 ไฟล์) ด้วย `git mv` รักษา history |
| `99-archives/04-00-docker-compose-QNAP/ARCHIVE-README.md` | สร้างใหม่ — อธิบายที่มา (ADR-041 + QNAP no Docker) + note การลบไฟล์ 2 ไฟล์โดยผู้ใช้ |
| `04-00-docker-compose/README.md` | อัปเดต layout diagram จาก QNAP+ASUSTOR → np-dms-lcbp3 (4 layers) + ASUSTOR; เพิ่ม ADR-041/real-world note |
| `04-Infrastructure-OPS/README.md` | อัปเดต version เป็น 1.9.13; อัปเดต Document Index (QNAP stacks archived); อัปเดตตาราง Live Compose (5 layers ของ np-dms-lcbp3 แทน QNAP subdirs) |
| `specs/README.md` | อัปเดต "Live compose stacks (QNAP + ASUSTOR)" → "(np-dms-lcbp3 + ASUSTOR)"; แก้ AI Isolation policy (Admin Desktop → np-dms-lcbp3, model stack ปัจจุบัน) |
| `04-00-docker-compose/np-dms-lcbp3/SPECS-VERIFICATION-PLAN.md` | อัปเดต QNAP path ref → archive location |

> **Note:** ผู้ใช้ลบ `app/.env.example` และ `app/docker-compose-app.yml` ออกจาก archive QNAP/app (ไม่จำเป็นต้องเก็บ) — บันทึกใน ARCHIVE-README

### Phase 3 — Annotate AI Speckit feature folders (13 folders)

กลยุทธ์ "Annotate header เท่านั้น" ตามที่ผู้ใช้อนุมัติ — เพิ่ม note block หลัง `# Feature Specification:` title ใน `spec.md` ของทุกโฟลเดอร์:

```markdown
> ⚠️ **Implementation History (superseded by ADR-043):** เอกสารนี้เป็นประวัติการ implement ของ feature ที่เกี่ยวกับ AI — สถาปัตยกรรม AI ปัจจุบันรวมอยู่ใน [ADR-043: AI Architecture Current State](../../06-Decision-Records/ADR-043-ai-architecture-current-state.md) (Single Source of Truth, 2026-08-03) ใช้เอกสารนี้เป็น audit trail เท่านั้น ห้ามใช้เป็นที่อ้างอิงสถาปัตยกรรมปัจจุบัน
```

โฟลเดอร์ที่ annotate (13): `140-ocr-sidecar-refactor`, `232-typhoon-ocr-integration`, `233-ai-model-ocr-runner-management`, `234-rag-pipeline-enhancements`, `235-ai-runtime-policy-refactor`, `236-unified-ocr-architecture`, `237-unified-prompt-management-ux-ui`, `238-ocr-ai-prompt-separation`, `239-ai-console-ux-refactor`, `240-ai-console-collapsible-cards`, `241-ocr-persist-sandbox`, `301-unified-ai-arch`, `302-ai-model-revision`

### Phase 4.1 — Annotate 08-Tasks/ historical task files

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `08-Tasks/Task BE-AI-01.md`, `Task-BE-AI-02.md`, `Task-FE-AI-03.md` | เพิ่ม annotation block "ADRs referenced herein archived" (อ้าง ADR-018/020 ที่ archived แล้ว) |
| `08-Tasks/ADR-022-Retrieval-Augmented-Generation/plan.md` | เพิ่ม annotation block + แก้ broken path `06-Decision-Records/ADR-022-Retrieval-Augmented-Generation/` → `08-Tasks/ADR-022-Retrieval-Augmented-Generation/` (path ผิดมาตั้งแต่ก่อน archive) |

### Phase 4.2 — อัปเดต ADR ref ใน active requirements/scope docs

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `01-requirements/01-01-objectives.md` | แก้ "Migration Bot | ADR-017" → "ADR-023 → ADR-043 (ADR-017 archived)" |
| `03-Data-and-Storage/03-06-migration-business-scope.md` | แก้ "AI Isolation (ตาม ADR-018)" → "ADR-023 → ADR-043; ADR-018 archived" |

### Phase 4.3 — Annotate skills text-refs (ADR-018/020 archived)

กลยุทธ์: อัปเดต text ที่อ้าง ADR-018/020 เป็น authoritative ให้ชี้ไป ADR-023/043 แทน (mirror ทั้ง .devin/skills และ .agents/skills)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `nestjs-best-practices/rules/lcbp3-ai-boundary.md` | แก้ frontmatter title/tags + body "Admin Desktop" → "np-dms-lcbp3 (post-ADR-041)" |
| `nestjs-best-practices/SKILL.md` | แก้ description "ADR-018/020 (AI boundary)" → "ADR-023/023A/043 (supersedes archived ADR-018/020)" |
| `security-review/SKILL.md` | แก้ 4 จุด — ADR-018/020 refs → ADR-023/043 (พร้อมชี้ link ไป ADR-023 current + ADR-018 archived) |
| `verification-loop/SKILL.md` | แก้ security compliance list + ADR refs |
| **18 speckit SKILL.md** (102-206) | sed batch replace "ADR-018/020 AI boundary" → "ADR-023/043 AI boundary (supersedes ADR-018/020)" — 18 ไฟล์ × 2 mirror = 36 edits |

### Phase 5 — สแกน non-AI ADR

| ADR | สถานะ | ผลการตรวจ |
|---|---|---|
| ADR-009 (DB migration) | ⚠️ **พบ internal contradiction** | บรรทัด 27 "Chose TypeORM Migrations" ขัดกับบรรทัด 50 "TypeORM with migrations disabled" และขัดกับ AGENTS.md "no TypeORM migrations — edit schema SQL directly (ADR-009)" — เป็น drift ที่ยังไม่ปิด **ต้อง escalate เพื่อสร้าง ADR amendment แยก** |
| ADR-019 (Hybrid UUID) | ✅ Active | ไม่มี supersede/amend chain — การอ้างอิงใน 05-Engineering-Guidelines ปกติ |
| ADR-021 (Workflow Context) | ✅ Active | ไม่มี supersede/amend chain — การอ้างอิงใน 200-fullstacks ปกติ |

## สิ่งที่ **ไม่แก้** (ตั้งใจ)

- ไฟล์ ADR เดิมทั้งหมด (รักษา audit trail ตาม ADR-REVIEW-PROCESS)
- `88-logs/` ทั้งหมด (session logs เป็นประวัติศาสตร์)
- `99-archives/` ส่วนใหญ่ (ยกเว้นเพิ่ม ARCHIVE-README)
- ADR-009 contradiction — เป็นประเด็นสถาปัตยกรรมที่ต้องทีมตัดสินใจ ไม่ใช่งาน cleanup

## ผลลัพธ์ (Verification)

- โฟลเดอร์ `04-00-docker-compose/` เหลือเฉพาะ active stacks: `np-dms-lcbp3/`, `ASUSTOR/`, `SECURITY-MIGRATION-v1.8.6.md`, `README.md`, `x-base.yml`, `.env.template` (QNAP และ Desk-5439 ถูกย้ายไป `99-archives/`)
- 13 AI feature folders มี annotation block ชี้ไป ADR-043 ใน `spec.md`
- ทุก skill ที่อ้าง "ADR-018/020 AI boundary" เป็น authoritative ถูกอัปเดตเป็น "ADR-023/043" (พร้อม note supersedes)
- ADR-009 contradiction ถูกระบุไว้ใน session log เพื่อ escalate

## งานที่เหลือ (escalate ไม่ใช่ cleanup)

- **ADR-009 internal contradiction** — บรรทัด 27 vs บรรทัด 50 ขัดกัน และขัดกับ AGENTS.md "no TypeORM migrations" — ต้องสร้าง ADR amendment (เช่น ADR-044) หรืออัปเดต ADR-009 ผ่าน ADR-REVIEW-PROCESS ไม่ใช่งาน cleanup อัตโนมัติ
- **QNAP NPM role change** — ADR-041 D2/D6 ระบุ NPM อยู่ QNAP แต่ของจริง QNAP ไม่มี Docker แล้ว (Cloudflare Tunnel บน np-dms-lcbp3 แทน) — อาจต้อง ADR amendment สำหรับ edge proxy topology

## หมายเหตุ

- ไม่ได้ commit (เป็น policy ปกติ — ผู้ใช้ไม่ได้ขอ commit)
- ผู้ใช้ลบ `app/.env.example` และ `app/docker-compose-app.yml` ออกจาก archive QNAP/app (การตัดสินใจของผู้ใช้ บันทึกใน ARCHIVE-README)
- รวม Phase 1-5 ทั้งหมด: 130 files changed, 570 insertions(+), 432 deletions(-)
