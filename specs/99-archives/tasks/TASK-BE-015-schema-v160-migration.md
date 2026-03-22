# Task: Backend Schema v1.6.0 Migration

**Status:** ✅ Completed
**Priority:** P1 (High - Breaking Changes)
**Estimated Effort:** 3-5 days
**Dependencies:** Schema v1.6.0 already created
**Owner:** Backend Team

---

## 📋 Overview

อัพเดท Backend Entities และ DTOs ให้ตรงกับ Schema v1.6.0 ที่มีการ Refactor โครงสร้างตาราง

---

## 🎯 Objectives

- [x] Update Correspondence Entities
- [x] Update RFA Entities (Shared PK Pattern)
- [x] Update DTOs for new field names
- [x] Update Services for new relationships
- [x] Add/Update Unit Tests

---

## 📝 Schema Changes Summary

### Breaking Changes ⚠️

| Table                       | Change                                         | Impact          |
| --------------------------- | ---------------------------------------------- | --------------- |
| `correspondence_recipients` | FK → `correspondences(id)`                     | Update relation |
| `rfa_items`                 | `rfarev_correspondence_id` → `rfa_revision_id` | Rename column   |

### Column Changes

| Table                      | Old                 | New                           | Notes       |
| -------------------------- | ------------------- | ----------------------------- | ----------- |
| `correspondence_revisions` | `title`             | `subject`                     | Rename      |
| `correspondence_revisions` | -                   | `body`, `remarks`             | Add columns |
| `rfa_revisions`            | `title`             | `subject`                     | Rename      |
| `rfa_revisions`            | `correspondence_id` | -                             | Remove      |
| `rfa_revisions`            | -                   | `body`, `remarks`, `due_date` | Add columns |

### Architecture Changes

| Table  | Change                                               |
| ------ | ---------------------------------------------------- |
| `rfas` | Shared PK with `correspondences` (no AUTO_INCREMENT) |
| `rfas` | `id` references `correspondences(id)`                |

---

## 🛠️ Implementation Steps

### 1. Update CorrespondenceRevision Entity

```typescript
// File: backend/src/modules/correspondence/entities/correspondence-revision.entity.ts

// BEFORE
@Column()
title: string;

// AFTER
@Column()
subject: string;

@Column({ type: 'text', nullable: true })
body: string;

@Column({ type: 'text', nullable: true })
remarks: string;

@Column({ name: 'schema_version', default: 1 })
schemaVersion: number;
```

### 2. Update CorrespondenceRecipient Entity

```typescript
// File: backend/src/modules/correspondence/entities/correspondence-recipient.entity.ts

// BEFORE
@ManyToOne(() => CorrespondenceRevision, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'correspondence_id', referencedColumnName: 'correspondenceId' })
revision: CorrespondenceRevision;

// AFTER
@ManyToOne(() => Correspondence, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'correspondence_id' })
correspondence: Correspondence;
```

### 3. Update RFA Entity (Shared PK Pattern)

```typescript
// File: backend/src/modules/rfa/entities/rfa.entity.ts

// BEFORE
@PrimaryGeneratedColumn()
id: number;

// AFTER
@PrimaryColumn()
id: number;

@OneToOne(() => Correspondence, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'id' })
correspondence: Correspondence;
```

### 4. Update RfaRevision Entity

```typescript
// File: backend/src/modules/rfa/entities/rfa-revision.entity.ts

// REMOVE
@Column({ name: 'correspondence_id' })
correspondenceId: number;

// RENAME
@Column()
subject: string;  // was: title

// ADD
@Column({ type: 'text', nullable: true })
body: string;

@Column({ type: 'text', nullable: true })
remarks: string;

@Column({ name: 'due_date', type: 'datetime', nullable: true })
dueDate: Date;
```

### 5. Update RfaItem Entity

```typescript
// File: backend/src/modules/rfa/entities/rfa-item.entity.ts

// BEFORE
@Column({ name: 'rfarev_correspondence_id' })
rfaRevCorrespondenceId: number;

// AFTER
@Column({ name: 'rfa_revision_id' })
rfaRevisionId: number;

@ManyToOne(() => RfaRevision, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'rfa_revision_id' })
rfaRevision: RfaRevision;
```

### 6. Update DTOs

```typescript
// correspondence/dto/create-correspondence-revision.dto.ts
export class CreateCorrespondenceRevisionDto {
  subject: string; // was: title
  body?: string;
  remarks?: string;
}

// rfa/dto/create-rfa-revision.dto.ts
export class CreateRfaRevisionDto {
  subject: string; // was: title
  body?: string;
  remarks?: string;
  dueDate?: Date;
}
```

---

## 🗂️ Files to Modify

### Entities

| File                                 | Status | Changes                                   |
| ------------------------------------ | ------ | ----------------------------------------- |
| `correspondence.entity.ts`           | ✅     | Minor: add recipients relation            |
| `correspondence-revision.entity.ts`  | ✅     | Rename title→subject, add body/remarks    |
| `correspondence-recipient.entity.ts` | ✅     | FK change to correspondence               |
| `rfa.entity.ts`                      | ✅     | Shared PK pattern                         |
| `rfa-revision.entity.ts`             | ✅     | Remove correspondenceId, add body/remarks |
| `rfa-item.entity.ts`                 | ✅     | Rename column                             |

### DTOs

| File                                    | Status | Changes                         |
| --------------------------------------- | ------ | ------------------------------- |
| `create-correspondence-revision.dto.ts` | ✅     | title→subject, add body/remarks |
| `update-correspondence-revision.dto.ts` | ✅     | Same                            |
| `create-rfa-revision.dto.ts`            | ✅     | title→subject, add fields       |
| `update-rfa-revision.dto.ts`            | ✅     | Same                            |
| `create-rfa-item.dto.ts`                | ✅     | Column rename                   |

### Services

| File                        | Status | Changes                          |
| --------------------------- | ------ | -------------------------------- |
| `correspondence.service.ts` | ✅     | Update queries for new relations |
| `rfa.service.ts`            | ✅     | Handle Shared PK creation        |

---

## ✅ Verification

### Unit Tests

```bash
# Run existing tests to verify compatibility
pnpm test:watch correspondence
pnpm test:watch rfa
```

### Integration Tests

1. Create new Correspondence → verify subject field saved
2. Create new RFA → verify Shared PK pattern works
3. Verify recipients linked to correspondence (not revision)
4. Verify RFA items linked via rfa_revision_id

---

## 📚 Related Documents

- [Schema v1.6.0](../07-database/lcbp3-v1.6.0-schema.sql)
- [Data Dictionary v1.6.0](../07-database/data-dictionary-v1.6.0.md)
- [CHANGELOG v1.6.0](../../CHANGELOG.md)

---

## 🚨 Risks & Mitigation

| Risk              | Impact | Mitigation                           |
| ----------------- | ------ | ------------------------------------ |
| Breaking frontend | High   | Update frontend types simultaneously |
| Data migration    | Medium | Schema already handles FK changes    |
| Test failures     | Low    | Update tests with new field names    |

---

## 📌 Notes

- Schema v1.6.0 SQL files already exist in `specs/07-database/`
- This task focuses on **backend code changes only**
- Frontend will need separate task for DTO/type updates
- Consider feature flag for gradual rollout
