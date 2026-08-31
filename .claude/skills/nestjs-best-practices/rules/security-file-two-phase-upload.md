---
title: Two-Phase File Upload + ClamAV (ADR-016)
impact: CRITICAL
impactDescription: Upload → Temp → ClamAV scan → Commit → Permanent. Whitelist + 50MB cap. StorageService only.
tags: file-upload, clamav, security, adr-016, storage
---

## Two-Phase File Upload (ADR-016)

**Never write uploaded files directly to permanent storage.** All uploads must go through:

```
Client → Upload endpoint → Temp storage → ClamAV scan → Commit endpoint → Permanent storage
```

---

## Constraints (non-negotiable)

| Rule | Value |
| --- | --- |
| Allowed MIME types | `application/pdf`, `image/vnd.dwg`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/zip` |
| Allowed extensions | `.pdf`, `.dwg`, `.docx`, `.xlsx`, `.zip` |
| Max size | 50 MB |
| Temp TTL | 24 h (purged by cron) |
| Virus scan | ClamAV (blocking) |
| Mover | `StorageService` only — never `fs.rename` directly from controller |

---

## Phase 1: Upload to Temp

```typescript
@Post('upload')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
}))
async uploadTemp(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: User,
): Promise<{ tempId: string; expiresAt: string }> {
  // 1. Validate MIME + extension (defense in depth)
  this.fileValidator.assertAllowed(file);

  // 2. Scan with ClamAV
  const scanResult = await this.clamavService.scan(file.buffer);
  if (!scanResult.clean) {
    throw new BusinessException(
      `ClamAV rejected: ${scanResult.signature}`,
      'ไฟล์ไม่ปลอดภัย ระบบตรวจพบความเสี่ยง',
      'กรุณาตรวจสอบไฟล์และลองใหม่อีกครั้ง',
      'FILE_INFECTED',
    );
  }

  // 3. Save to temp (encrypted at rest)
  const tempId = await this.storageService.saveToTemp(file, user.id);

  return {
    tempId,
    expiresAt: addHours(new Date(), 24).toISOString(),
  };
}
```

---

## Phase 2: Commit in Transaction

The business operation (e.g., creating a Correspondence) promotes temp files to permanent **in the same DB transaction**.

```typescript
async createCorrespondence(dto: CreateCorrespondenceDto, user: User) {
  return this.dataSource.transaction(async (manager) => {
    // 1. Create domain entity
    const entity = await manager.save(Correspondence, {
      ...dto,
      createdById: user.id,
    });

    // 2. Commit temp files → permanent (ACID together with entity)
    await this.storageService.commitFiles(
      dto.tempFileIds,
      { entityId: entity.id, entityType: 'correspondence' },
      manager,
    );

    return entity;
  });
}
```

If the transaction rolls back, temp files remain and expire in 24h — no orphaned permanent files.

---

## StorageService Contract

```typescript
export interface StorageService {
  saveToTemp(file: Express.Multer.File, ownerId: number): Promise<string>;
  commitFiles(
    tempIds: string[],
    target: { entityId: number; entityType: string },
    manager: EntityManager,
  ): Promise<FileRecord[]>;
  purgeExpiredTemp(): Promise<number>; // called by cron
  getPermanentPath(fileId: number): Promise<string>;
}
```

---

## ❌ Forbidden

```typescript
// ❌ Direct write to permanent
fs.writeFileSync(`/var/storage/${file.originalname}`, file.buffer);

// ❌ Skip ClamAV
await this.storageService.savePermanent(file);

// ❌ Non-whitelist MIME
@UseInterceptors(FileInterceptor('file')) // no size or type limit

// ❌ Commit outside transaction
const entity = await this.repo.save(...);
await this.storageService.commitFiles(tempIds, ...); // race: entity exists, files may fail
```

---

## Reference

- [ADR-016 Security & Authentication](../../../../specs/06-Decision-Records/ADR-016-security-authentication.md)
- [Edge Cases](../../../../specs/01-Requirements/01-06-edge-cases-and-rules.md) — file upload scenarios
