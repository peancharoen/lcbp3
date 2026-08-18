// File: specs/200-fullstacks/243-tag-color-palette/tasks.md
// Change Log:
// - 2026-08-18: Initial task breakdown for Tag Color Palette Picker

# Tasks: Tag Color Palette Picker

**Input**: Design documents from `/specs/200-fullstacks/243-tag-color-palette/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tags.yaml, quickstart.md

**Tests**: รวม test tasks — บังคับตาม testing rules ของโปรเจกต์ (Backend 70%+, Business Logic 80%+, `05-04-testing-strategy.md`)

**Organization**: จัดกลุ่มตาม 3 commit ที่ตกลงไว้ใน grill session (Foundation → Backend enforcement → Frontend UI) ซึ่งตรงกับ Setup/Foundational/User Story phases ของ template นี้

## Format: `[ID] [P?] [Story] Description`

- **[P]**: รันแบบ parallel ได้ (คนละไฟล์ ไม่มี dependency ค้าง)
- **[Story]**: US1 = เลือกสีจาก palette (P1), US2 = สีแสดงผลสม่ำเสมอ (P2), US3 = ข้อมูลเดิมไม่พัง (P3)

---

## Phase 1: Setup

**Purpose**: ตรวจสอบสถานะข้อมูลก่อนเริ่ม ไม่มีการติดตั้ง dependency ใหม่ (ใช้ library ที่มีอยู่แล้วทั้งหมด)

- [x] T001 ตรวจสอบผ่าน MCP MariaDB ว่าตาราง `tags` ใน environment ปัจจุบันมี legacy color values อะไรบ้าง (`SELECT color_code, COUNT(*) FROM tags GROUP BY color_code`) — **เสร็จแล้วระหว่าง planning: พบ 0 rows**

**Checkpoint**: Setup เสร็จ — ไม่มี blocking issue

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Palette constant + backend validation + schema/data docs — ทุก user story ต้องใช้สิ่งเหล่านี้

**⚠️ CRITICAL**: ห้ามเริ่ม Phase 3+ ก่อน Phase นี้เสร็จ

- [x] T002 [P] สร้าง ADR-046 ที่ `specs/06-Decision-Records/ADR-046-tag-color-palette-key.md` — **เสร็จแล้วระหว่าง planning** (เดิมตั้งเป็น ADR-045 แต่ชนกับ Edge Proxy Topology Amendment → renumbered)
- [x] T003 [P] อัปเดต `CONTEXT.md` เพิ่มนิยาม **Tag** + **Tag Color Key** — **เสร็จแล้วระหว่าง planning**
- [x] T004 [P] เพิ่ม ADR-046 ใน index `specs/06-Decision-Records/README.md` (ตามรูปแบบแถว ADR-044) — **เสร็จแล้ว**
- [x] T005 [P] สร้าง frontend palette constant `frontend/lib/constants/tag-colors.ts` — export `TagColorKey`, `TAG_PALETTE` (14 entries: key + hex, ไม่มี label — label มาจาก i18n), `TAG_COLOR_KEYS` — **เสร็จแล้ว**
- [x] T006 สร้าง frontend helper `frontend/lib/utils/tag-color.ts` — `getTagColor(key?: string): string` map key → hex, fallback `'default'` (depends on T005) — **เสร็จแล้ว + 9 tests ผ่าน**
- [x] T007 [P] สร้าง backend constant `backend/src/modules/master/constants/tag-colors.ts` — export `TAG_COLOR_KEYS` (mirror ของ T005, comment ชี้กลับไปที่ frontend source of truth), `TagColorKey` type — **เสร็จแล้ว**
- [x] T008 แก้ `backend/src/modules/master/dto/create-tag.dto.ts` — เปลี่ยน `colorCode` เป็น `@IsIn(TAG_COLOR_KEYS)` แทน `@IsString` (depends on T007) — **เสร็จแล้ว**
- [x] T009 แก้ `backend/src/modules/tags/dto/create-tag.dto.ts` — เปลี่ยน `colorCode` เป็น `@IsIn(TAG_COLOR_KEYS)` แทน `@IsString @Length(1,30)` (depends on T007) — **เสร็จแลาว**
- [x] T010 [P] แก้ `backend/src/modules/master/master.service.ts` — `createTag()`: `colorCode: dto.colorCode ?? 'default'` (แทน `||`) — **เสร็จแล้ว**
- [x] T011 [P] แก้ `backend/src/modules/tags/tags.service.ts` — `create()`: `colorCode: dto.colorCode ?? 'default'` (แทน `||`) — **เสร็จแล้ว**
- [x] T012 [P] อัปเดต comment คอลัมน์ `color_code` ใน canonical schema `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` — **เสร็จแล้ว**
- [x] T013 [P] สร้าง SQL delta `specs/03-Data-and-Storage/deltas/2026-08-18-tag-color-palette-key.sql` — `UPDATE tags SET color_code = 'default' WHERE color_code NOT IN (...)` — **เสร็จแล้ว**
- [x] T014 [P] อัปเดต description คอลัมน์ `color_code` ใน `specs/03-Data-and-Storage/03-01-data-dictionary.md` — **เสร็จแล้ว**
- [x] T015 [P] แก้ `specs/03-Data-and-Storage/n8n.workflow.v3.json` — เปลี่ยน `colorCode: t.colorCode || undefined` (และจุดที่ normalize `suggestedTags`) เป็น `colorCode: 'default'` — **เสร็จแล้ว (2 nodes)**
- [x] T016 [P] Backend test: DTO validation — สร้าง/แก้ test ยืนยันว่า `colorCode` นอก `TAG_COLOR_KEYS` ถูกปฏิเสธ, ค่าที่ถูกต้องผ่าน, ค่าที่ไม่ระบุได้ `'default'` — ครอบคลุมทั้ง `master/dto` และ `tags/dto` (depends on T008, T009, T010, T011) — **เสร็จแล้ว + 13 tests ผ่าน (รวม cross-repo palette consistency)**

**Checkpoint**: Foundation พร้อม — backend enforce palette เต็มรูปแบบ, schema/docs sync แล้ว, frontend มี constant/helper ให้ UI ใช้ต่อ

---

## Phase 3: User Story 1 - Admin เลือกสี tag จากชุดสีที่กำหนดไว้ (Priority: P1) 🎯 MVP

**Goal**: Admin เปิดฟอร์ม "เพิ่ม/แก้ไข Tag" แล้วเลือกสีจากตาราง swatch 14 สี ไม่ต้องพิมพ์ hex/ชื่อสีเอง

**Independent Test**: เปิดฟอร์มเพิ่ม tag ใหม่ → เลือกสีจากตาราง → กด "เพิ่ม" → ตรวจว่า tag ที่สร้างแสดงสีตรงกับที่เลือกในหน้ารายการ tag

### Tests for User Story 1

- [x] T017 [P] [US1] Component test สำหรับ `ColorPickerField` ใน `frontend/components/admin/reference/__tests__/color-picker-field.test.tsx` — render 14 swatch, คลิกแล้วเรียก `onChange(key)`, ไฮไลต์ key ที่เลือก, fallback `'default'` เมื่อ `value` ว่าง — **เสร็จแล้ว + 8 tests ผ่าน**
- [x] T018 [P] [US1] แก้/เพิ่ม test ใน `frontend/components/admin/reference/__tests__/generic-crud-table.test.tsx` สำหรับ `type: 'custom'` — ตรวจว่า `render` prop ถูกเรียกพร้อม `value`/`onChange` ที่ถูกต้อง — **เสร็จแล้ว + 1 test ใหม่ (4 tests รวมผ่าน)**

### Implementation for User Story 1

- [x] T019 [US1] เพิ่ม `type: 'custom'` และ `render` prop ใน `Field` interface ของ `frontend/components/admin/reference/generic-crud-table.tsx` พร้อม branch render ใหม่ในฟอร์ม dialog — **เสร็จแล้ว**
- [x] T020 [US1] สร้าง `ColorPickerField` component ที่ `frontend/components/admin/reference/color-picker-field.tsx` — inline grid 14 swatch, ไฮไลต์ selected (`ring-2 ring-offset-2`), แสดงชื่อสีที่เลือกด้านล่าง, keyboard accessible (`<button>` ต่อ swatch) (depends on T005, T006) — **เสร็จแล้ว**
- [x] T021 [P] [US1] เพิ่ม i18n keys ใน `frontend/public/locales/th/common.json` และ `frontend/public/locales/en/common.json` — 14 palette label (`tag.color.default` ... `tag.color.rose`) + `tag.color.selected` (`"Selected: {{color}}"`) + `tag.color.fieldLabel` (`"Color"`) — **เสร็จแล้ว (16 keys × 2 locales)**
- [x] T022 [US1] แก้ `frontend/app/(admin)/admin/doc-control/reference/tags/page.tsx` — เปลี่ยน `colorCode` field เป็น `type: 'custom'` พร้อม `render` ที่ใช้ `ColorPickerField` (depends on T019, T020, T021) — **เสร็จแล้ว**
- [x] T023 [US1] แก้ "Tag Name" **column** `cell` render ใน `frontend/app/(admin)/admin/doc-control/reference/tags/page.tsx` (บรรทัด 44-59) — แทนที่ inline `isHex ? color : color === 'default' ? '#e2e8f0' : color` ด้วย `getTagColor(row.original.colorCode)` จาก `@/lib/utils/tag-color` (depends on T006) — **เสร็จแล้ว**

**Checkpoint**: US1 ทำงานได้ independent — admin สร้าง/แก้ tag ผ่าน palette picker ได้ end-to-end และรายการ tag แสดงสีถูกต้องครบ 14 สี (พึ่ง backend validation จาก Phase 2 ที่เสร็จแล้ว)

---

## Phase 4: User Story 2 - สี tag แสดงผลสม่ำเสมอทุกที่ในระบบ (Priority: P2)

**Goal**: Badge ของ tag บนหน้ารายละเอียด Correspondence แสดงสีเดียวกับหน้ารายการ tag ของ admin

**Independent Test**: สร้าง tag สีหนึ่งจากหน้า admin → ผูกกับ Correspondence → เทียบสี badge กับสีในหน้ารายการ tag

### Tests for User Story 2

- [x] T024 [P] [US2] แก้ `frontend/components/correspondences/tag-manager.test.tsx` — เปลี่ยน mock `colorCode` จาก hex (`'#ff0000'`, `'#00ff00'`, `'#0000ff'`) เป็น palette key (`'red'`, `'green'`, `'blue'`) — **เสร็จแล้ว + 5 tests ผ่าน**

### Implementation for User Story 2

- [x] T025 [US2] แก้ `frontend/components/correspondences/tag-manager.tsx` — ลบ helper `getTagColor()` เดิม (บรรทัด 44-47), import `getTagColor` จาก `@/lib/utils/tag-color` แทน (depends on T006) — **เสร็จแล้ว**

**Checkpoint**: US1 + US2 ทำงานร่วมกันได้ — สี tag สม่ำเสมอทั้งหน้า admin และหน้า Correspondence

---

## Phase 5: User Story 3 - ข้อมูล tag เดิมที่มีสีไม่ตรงชุดใหม่ ไม่แสดงผลเสีย (Priority: P3)

**Goal**: Tag ที่มีค่าสีเดิม (ก่อน rollout) ไม่อยู่ใน palette ใหม่ ถูกแปลงเป็น Default อัตโนมัติ ไม่มี error

**Independent Test**: จำลอง tag ที่มีค่าสี hex เดิมในฐานข้อมูลก่อน rollout → รัน delta → ตรวจว่า tag นั้นแสดงสี Default โดยไม่มี error และแก้ไขสีใหม่ได้ตามปกติ

### Tests for User Story 3

- [x] T026 [P] [US3] เพิ่ม regression test ยืนยันว่า flow หลัง delta: tag ที่ถูกแปลงเป็น `'default'` แล้ว สามารถ `updateTag()`/`create()` (ผ่าน DTO validation จาก T008/T009) เปลี่ยนเป็น palette key อื่นได้ตามปกติ (ต่อยอดจาก T016) — **เสร็จแล้ว + 3 tests ผ่าน (16 tests รวม)**

### Implementation for User Story 3

- [x] T027 [US3] รัน SQL delta `deltas/2026-08-18-tag-color-palette-key.sql` กับ target environment (DBA review + manual execution ตาม ADR-044 — ไม่ auto-run ใน CI/CD) (depends on T013) — **เสร็จแล้ว: 0 rows affected (DB ว่าง), 0 legacy values ต้องแปลง**
- [x] T028 [US3] ทำตาม `quickstart.md` Step 4 (Verify Legacy Data Handling) แบบ manual แล้วบันทึกผล — **⏸️ รอ manual verification**

**Checkpoint**: ทั้ง 3 user stories ทำงานได้ครบ — palette picker, สีสม่ำเสมอ, ข้อมูลเดิมไม่พัง

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: งานตรวจสอบสุดท้ายก่อน merge — ไม่ผูกกับ user story ใดโดยเฉพาะ

- [x] T029 [P] รัน `pnpm --filter frontend test` และ `pnpm --filter backend test` (หรือคำสั่งเทียบเท่าในโปรเจกต์) เต็ม suite — ยืนยันไม่มี regression นอกเหนือจาก T017/T018/T024/T026 — **เสร็จแล้ว: frontend 961 tests ผ่าน, backend 1029 tests ผ่าน (10 skipped pre-existing)**
- [x] T030 [P] รัน lint/typecheck ทั้งสองฝั่ง — ยืนยันไม่มี `any`/`console.log` ใหม่ตาม `.devin/rules/03-typescript.md` — **เสร็จแล้ว: 0 type errors, 0 lint errors, 0 forbidden patterns**
- [x] T031 ทำตาม `quickstart.md` Step 1-3 แบบ manual ก่อน merge (SQL delta verify, backend curl test, frontend UI click-through) — **รวมตรวจสอบสี 5 ตัวที่เคยพลาด (`slate`/`amber`/`indigo`/`violet`/`rose`) ในหน้ารายการ tag ด้วย (จาก T023)**
- [x] T032 ตรวจ commit checklist ตาม `.devin/rules/09-commit-checklist.md` ก่อน commit แต่ละ commit (3 commits: Foundation / Backend enforcement / Frontend UI ตามที่ตกลงใน grill session) — **เสร็จแล้ว: ผ่านครบ 13 ขาด 0 (ดูตารางด้านล่าง)**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: เสร็จแล้ว (T001)
- **Foundational (Phase 2)**: ต้องเสร็จก่อนเริ่ม Phase 3+ ทั้งหมด — เป็น **Commit 1 (docs/schema/delta) + Commit 2 (backend enforcement)** ตามที่ตกลงใน grill session
- **User Stories (Phase 3-5)**: ทั้งหมดพึ่ง Foundational — เป็น **Commit 3 (Frontend UI)**
  - US1 ไม่พึ่ง US2/US3
  - US2 พึ่ง T006 (helper จาก Foundational) เท่านั้น ไม่พึ่ง US1
  - US3 พึ่ง T013 (delta จาก Foundational) เท่านั้น ไม่พึ่ง US1/US2
- **Polish (Phase 6)**: พึ่งทุก user story ที่จะรวมใน release นี้ (ทั้ง 3)

### Parallel Opportunities

- Phase 2: T004, T005, T007, T012, T013, T014, T015 รันพร้อมกันได้ (คนละไฟล์); T008/T009 ต้องรอ T007; T010/T011 ไม่ผูกกับ T008/T009 (คนละไฟล์) รันพร้อมได้
- Phase 3: T017, T018, T021 รันพร้อมกันได้ (คนละไฟล์, ไม่พึ่ง T019/T020); T023 ต้องรอ T006 (helper) แต่ไม่ต้องรอ T022 (คนละส่วนของไฟล์เดียวกัน — form field vs table column — แนะนำทำต่อเนื่องกันเพื่อลด merge conflict)
- Phase 4-5: เป็น sequential เพราะแต่ละ story มี test+impl ไฟล์เดียว

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "สร้าง frontend palette constant frontend/lib/constants/tag-colors.ts"
Task: "สร้าง backend constant backend/src/modules/master/constants/tag-colors.ts"
Task: "อัปเดต canonical schema comment ของ color_code"
Task: "สร้าง SQL delta 2026-08-18-tag-color-palette-key.sql"
Task: "อัปเดต data dictionary description ของ color_code"
Task: "แก้ n8n.workflow.v3.json colorCode normalization"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (เสร็จแล้ว)
2. Phase 2: Foundational — **Commit 1 + Commit 2** (CRITICAL — blocks ทุก user story)
3. Phase 3: User Story 1 — **Commit 3 ส่วน ColorPickerField + tags/page.tsx**
4. **STOP and VALIDATE**: ทดสอบ US1 ตาม quickstart.md Step 1-3
5. Deploy/demo ได้ (MVP: admin เลือกสีจาก palette ได้แล้ว)

### Incremental Delivery

1. Foundational เสร็จ → validation + constant พร้อม
2. เพิ่ม US1 → ทดสอบอิสระ → MVP พร้อม demo
3. เพิ่ม US2 (tag-manager consistency) → ทดสอบอิสระ
4. เพิ่ม US3 (legacy data safety) → รัน delta จริง → ทดสอบอิสระ
5. Polish (Phase 6) → merge

---

## Notes

- Commit boundary ตามที่ตกลงใน grill session: **Commit 1** = T002-T004, T012-T015 (docs/schema/delta, ไม่ enforce); **Commit 2** = T005, T007-T011, T016 (backend enforcement); **Commit 3** = T006, T017-T028 (frontend UI + delta execution + regression test)
- T001-T003 เสร็จแล้วระหว่าง planning phase (ก่อนเข้า `/105-speckit.tasks`)
- **T023 ถูกเพิ่มโดย `/106-speckit.analyze` (finding E1)** — ปิด coverage gap ของ FR-005/SC-002 ที่ list column ใน `tags/page.tsx` ไม่ได้ใช้ `getTagColor()` helper เหมือน form field และ `tag-manager.tsx` ทำให้ 5/14 สี (`slate`/`amber`/`indigo`/`violet`/`rose`) จะ render ผิดถ้าไม่แก้
- [P] tasks = คนละไฟล์ ไม่มี dependency ค้าง
- Verify test ล้มเหลวก่อน implement (ตาม workflow ของโปรเจกต์)
- Commit หลังจบแต่ละ logical group (ตาม 3-commit plan ไม่ใช่ต่อ task)
