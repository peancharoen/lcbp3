# Specification Quality Checklist: Rclone Google Drive Sync

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — Note: infrastructure spec necessarily references rclone/cron/logrotate/Uptime Kuma as these ARE the entities being configured
- [x] Focused on user value and business needs (offsite backup + team doc sharing)
- [x] Written for non-technical stakeholders (summary section)
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (`rclone size > 0`, no `.env` in `rclone ls --include ".env"`, Uptime Kuma "Up")
- [x] Success criteria are technology-agnostic (no implementation details) — Note: infrastructure success criteria necessarily reference specific tools (rclone, cron, logrotate, Uptime Kuma) as these are the measurable targets
- [x] All acceptance scenarios are defined (3 user stories × 4-5 scenarios each)
- [x] Edge cases are identified (URL ซ้อนกัน, `sudo -u` ทำให้ `$HOME` ผิด, OAuth token หมดอายุ, Google Drive quota)
- [x] Scope is clearly bounded (one-way sync only, no `bisync`, no source code changes)
- [x] Dependencies and assumptions identified (Google Cloud project, Uptime Kuma instance, headless server)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (backup, sharing, monitoring)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — Note: tool names and cron schedules are scope requirements, not implementation details

## Security Checklist (ADR-016)

- [x] `.env` excluded from sync (`--exclude ".env"`)
- [x] `.git/` excluded from sync (prevent history leak + reduce size)
- [x] OAuth Client ของตัวเอง (ไม่ใช้ shared rclone client_id)
- [x] Test users ระบุใน OAuth consent screen
- [x] Token เก็บใน `~/.config/rclone/rclone.conf` ของ user `np-dms` เท่านั้น
- [x] Dry-run validation ก่อนรันจริงทุกครั้ง
- [x] ตรวจ `rclone ls --include ".env"` หลัง sync ว่าคืนค่าว่าง

## Observability Checklist (ADR-010)

- [x] Log file ที่ `/var/log/rclone/` ระดับ INFO
- [x] Logrotate ตั้งไว้ (weekly rotate 4 compress)
- [x] Uptime Kuma Push Monitor ผูกกับทุก cron job
- [x] Notification channel ผูกกับ monitor (Telegram Bot / Email)
- [x] Push สถานะ `status=up` เมื่อสำเร็จ และ `status=down` เมื่อล้มเหลว

## Notes

- This is an infrastructure runbook spec, so specific tool names (rclone, cron, logrotate, Uptime Kuma) and cron schedules are part of the scope definition, not implementation details
- The spec references `docs/Rclone gdrive sync setup.md` as the source runbook (already implemented and operational)
- The spec is migrated into `specs/100-Infrastructures/` to follow the speckit structure and cross-link with `04-02-backup-recovery.md` (Offsite Backup section)
- All items pass — spec is ready for `/speckit-clarify` or `/speckit-plan` (already implemented, so this is documentation retro-fit)
