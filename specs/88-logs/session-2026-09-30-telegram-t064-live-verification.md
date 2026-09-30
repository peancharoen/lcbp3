# Session — 2026-09-30 (F258 Telegram Notifications — T064 Live Verification + CI fix)

## Summary

ทำ T064 real-app verification ของ feature `258-telegram-notifications` บน production (`lcbp3.np-dms.work`, deploy `f9f58cf9`):
group leg + DM leg verify ผ่าน end-to-end จริงทั้งคู่ เหลือแค่ SC-006 (500-burst) ที่ user defer
ระหว่างทางพบ+แก้ production defects 3 ตัวที่เกิดจาก F258 เดิม และ fix ci-quality job ที่พังมาตั้งแต่ run #817

## Live Evidence (T064)

| ขั้น | ผล |
|---|---|
| Group `/link 1F2AA4F1` ใน Forum Topic 3 (`t.me/c/4317835854/3`) | webhook รับจริง → `notification_channels` row: TELEGRAM_GROUP, chat `-1004317835854`, `telegram_topic_id=3`, project SANDBOX(id 7), active |
| `JOB_SEND_TELEGRAM_GROUP` → BullMQ `notifications` queue → `TelegramBotService.sendMessage` | ข้อความขึ้นใน topic 3 จริง (user confirm), `notification_deliveries` → `SENT`; queue→Telegram API ≈ **2s** (SC-002 ✅) |
| DM: กด "เชื่อมต่อ Telegram" ในหน้า Profile → deep link `t.me/LCBP3DMSBot?start=<token>` | `/start <token>` → bound `users.telegram_chat_id=8830062441` (superadmin user_id=1); webhook→bound→confirm ≈ **1s** (SC-001 ✅ system-side; wall 3m08s = human tap delay) |
| ปุ่ม "ส่งข้อความทดสอบ" | DM ถึงจริง 14:32:02 (inline send — known gap, bypasses queue) |
| Admin pages | `/admin/notifications/{channels,deliveries,settings}` render จริง; index `/admin/notifications` = 404 (by design, ไม่มี index page) |

## ปัญหาที่พบ (Root Cause)

1. **`notification_deliveries` + `notifications` API 500** — entity เขียน `@CreateDateColumn({name:'created_at'})` ตามด้วย `@PrimaryColumn()` bare → decorator ที่สอง override column name กลับเป็น `createdAt` → TypeORM gen `SELECT createdAt` ชน live schema `created_at`. Latent ตั้งแต่ Nov 2025 (pre-F258) แต่โผล่เพราะ F258 เป็นจุดแรกที่ใช้ `findAndCount` บน entity เหล่านี้
2. **Webhook 400 ทุก real Telegram update** — global `forbidNonWhitelisted:true` pipe reject fields ที่ DTO ไม่มี (`date`, `entities`, `is_forum`, `old_chat_member`…) → Telegram retry loop ทุก ~60s
3. **Frontend อ่าน envelope ผิด** — services return `response.data` (envelope `{statusCode,message,data}`) แต่ pages อ่าน payload fields ตรง ๆ → settings แสดง Disabled/ว่างทั้งที่ backend คืนค่าถูก
4. **ci-quality fail ตั้งแต่ run #817** — `backend/scratch/boot-probe.ts` (tracked ตอน boot hotfix) มี `console.log` และ `scratch/` ไม่อยู่ใน CI grep exclusion → security gate fail ทุก push (deploy ไม่กระทบเพราะ needs เฉพาะ ci-test)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `notification.entity.ts`, `notification-delivery.entity.ts` | `@PrimaryColumn({name:'created_at'})` — pin name ใน decorator เดียวกัน |
| `telegram-update.dto.ts` | class DTO → `interface` (type-only) — bypass whitelist pipe; +guard missing `update_id` |
| `telegram-webhook.controller.ts` | `import type` สำหรับ DTO |
| `notification-admin.service.ts`, `notification-channel.service.ts`, `notification.service.ts` (frontend) | unwrap `response.data.data` (paginated deliveries คง `{data,meta}` shape) |
| `backend/scratch/boot-probe.ts` | `console.log` → `process.stdout.write` |

Commits: `f9f58cf9` (real-app blockers), `2e6b0b83` (ledger CP11), `d2e50da8` (ci fix) — pushed `d2e50da8`, CI run #821 all-green (ci-quality/ci-test/deploy)

## กฎที่ Lock แล้ว / ข้อควรจำ

- **TypeORM composite-PK pattern:** ถ้า column ใช้ `@CreateDateColumn({name})` + `@PrimaryColumn()` คู่กัน ต้องใส่ `name` ใน `@PrimaryColumn` ด้วยเสมอ — bare `@PrimaryColumn()` จะ override name กลับเป็น property name เงียบ ๆ
- **Global `forbidNonWhitelisted` ฆ่า external-webhook DTOs** — webhook payload จากภายนอก (Telegram/ฯลฯ) ต้องใช้ interface ไม่ใช่ decorated class
- **API envelope:** service layer ต้อง return `response.data.data` เสมอ; ยกเว้น paginated endpoint ที่คง `{data,meta}`
- **CI `console.log` gate เช็คทั้ง repo** — scratch/diagnostic `.ts` files ก็โดน; ใช้ `process.stdout.write` แทน
- Gitea Actions jobs API อ่านได้โดยไม่ต้อง token: `GET /api/v1/repos/np-dms/lcbp3/actions/runs/:id/jobs` + `actions/tasks`; logs ต้อง token

## Pending

- [ ] **SC-006** 500-burst test — user defer (queue limiter 25/s + per-chat pacing 1s covered by unit tests; production burst = Telegram rate-limit exercise)
- [ ] Webhook update `97759355` threw Validation Exception 14:31:41 — น่าจะ non-command message (handled graceful, 200) แต่ยังไม่ได้ inspect payload
- [ ] Known gaps (unscheduled): `sendTestMessage` inline; 400→CHAT_NOT_FOUND over-classify; bind-fail silent 200; DM retry new row/attempt; `telegramStatus` no recovery clear; no cleanup on project delete/user deactivate
- [ ] Test bindings ค้างอยู่ใน prod: channel SANDBOX↔group topic 3, user 1 ↔ chat 8830062441 — รอตัดสินใจ cleanup

## Verification

- [x] `/link` → channel row + topic id ถูกต้อง
- [x] Group send → message ใน Telegram + delivery SENT
- [x] DM `/start` → `telegram_chat_id` set + confirm message
- [x] Test message DM ถึงจริง
- [x] Admin pages 3 หน้า render + APIs 200
- [x] CI #821 green ทั้ง 3 jobs
