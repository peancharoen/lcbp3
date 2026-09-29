# Data Model: Telegram Notifications

**Schema changes: yes** (ADR-044 — แก้ `schema-02-tables.sql` ตรง ไม่มี TypeORM migration)
**Feature**: `258-telegram-notifications` | **Date**: 2026-09-25

## MariaDB — `users` (ALTER)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `telegram_chat_id` | VARCHAR(50) | NULL, UNIQUE | Telegram Chat ID สำหรับส่ง DM — send target เดียวที่ Bot API รับ (ได้จาก deep-link flow เท่านั้น ห้ามให้ user กรอกเอง) |
| `telegram_username` | VARCHAR(100) | NULL | `@username` สำหรับแสดงผล/ค้นหาใน admin — user เปลี่ยนได้ทุกเมื่อ ห้ามใช้เป็น send target |
| `telegram_linked_at` | TIMESTAMP | NULL | เวลาที่ผูกบัญชีสำเร็จ (audit) — NULL พร้อม chat_id หมายถึง binding ถูกล้าง |

- `UNIQUE (telegram_chat_id)` บังคับ "1 chat id = 1 DMS user" (MariaDB ยอมหลาย NULL)
- Binding state = `telegram_chat_id IS NOT NULL`; unreachable flag อยู่ฝั่ง delivery log ไม่ใช่ users
- ห้าม expose ใน API response เกินจำเป็น — ส่งเฉพาะ `linked: boolean` + `telegramUsername` + `telegramLinkedAt` ให้ owner/admin

## MariaDB — `user_preferences` (ALTER)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `notify_telegram` | BOOLEAN | DEFAULT FALSE | เปิดรับแจ้งเตือนผ่าน Telegram (default FALSE — opt-in ตาม security posture) |

- `digest_mode` มีผลกับ Telegram **DM** เหมือน channel อื่น (FR-007) — **ไม่มีผลกับ group post** (Clarification Q2): `notifyProject()` ไม่ query `user_preferences` เลย เพราะ group ไม่มี "owner" คนเดียวให้ digest แทน — ส่ง real-time เสมอ

## MariaDB — `notifications` (ALTER ENUM)

```sql
notification_type ENUM('EMAIL','LINE','TELEGRAM','SYSTEM') NOT NULL
```

- เพิ่ม `'TELEGRAM'` — DM ต่อ user ยังลง row ใน notifications เหมือน channel เดิม (audit + in-app inbox)
- **Applied & verified on live DB (192.168.10.11, 2026-09-25)**: ค้นพบว่า enum จริงบน DB ไม่มี trailing space บน `'SYSTEM'` (เอกสาร schema เดิมเขียนผิดเป็น `'SYSTEM '` มี space — ไม่ตรงกับของจริงมาตั้งแต่ก่อน feature นี้) — apply ตามของจริงและแก้เอกสารให้ตรง

## MariaDB — `notification_channels` (CREATE)

จุดหมายภายนอกที่ bind ได้ — group/channel ต่อ project หรือ global

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AI | Internal id (ห้าม expose — ADR-019) |
| `uuid` | UUID | NOT NULL, UNIQUE, DEFAULT UUID() | publicId (ADR-019) |
| `channel_type` | ENUM('TELEGRAM_GROUP','TELEGRAM_CHANNEL','LINE') | NOT NULL | ชนิดปลายทาง (รองรับ LINE ในอนาคต) |
| `external_chat_id` | VARCHAR(50) | NOT NULL | chat_id ของ group/channel (ติดลบเสมอสำหรับ group) |
| `project_id` | INT | NULL, FK → projects(id) ON DELETE CASCADE | โครงการเจ้าของ — NULL = global scope |
| `name` | VARCHAR(100) | NULL | ชื่อกลุ่มแสดงใน admin console |
| `is_active` | TINYINT(1) | DEFAULT 1 | ปิดชั่วคราวโดยไม่ลบ binding; auto=0 เมื่อ bot ถูกเตะออกจากกลุ่ม |
| `telegram_topic_id` | INT | NULL | **[เพิ่มหลัง plan — Forum Topics]** `message_thread_id` ของ Telegram forum topic ถ้าผูกเฉพาะ topic (เช่น "Correspondences" ใน group "LCBP3"); `NULL` = ผูกทั้งกลุ่ม/general chat (ไม่ใช่ forum หรือพิมพ์ `/link` นอก topic) |
| `last_error` | VARCHAR(255) | NULL | เหตุผลล่าสุดที่ส่งไม่สำเร็จ (แสดงใน admin) |
| `created_at` / `updated_at` | TIMESTAMP | | |
| `created_by` | INT | NULL, FK → users(user_id) ON DELETE SET NULL | admin ผู้ผูก channel |

Indexes: `UNIQUE uk_channel (channel_type, external_chat_id, telegram_topic_id)`, `INDEX (project_id, is_active)`

- **Cardinality (Clarification Q3)**: `project_id` เป็น 1:N โดยตั้งใจ (ไม่มี UNIQUE บน `project_id`) — โครงการหนึ่งผูกได้หลายกลุ่ม/topic; `notifyProject()` broadcast event เดียวกันไปทุก channel `is_active=1` ของ project นั้นเหมือนกันหมด ไม่มี per-channel event routing ใน v1
- **Forum Topics (เพิ่มหลัง plan)**: `uk_channel` รวม `telegram_topic_id` เพื่อให้ผูกได้หลาย topic ในกลุ่มเดียวกันแยกกัน (เช่น topic "Correspondences" กับ topic "RFA" ในกลุ่ม "LCBP3" ผูกกับคนละ project/scope ได้) — **caveat**: MariaDB UNIQUE index ยอมให้มีหลายแถวที่ `telegram_topic_id IS NULL` ซ้ำกันได้ (NULL ไม่ถือว่าซ้ำ) ดังนั้น bind กลุ่มเดียวกันแบบ "ทั้งกลุ่ม" ซ้ำสองครั้งจะไม่ถูก DB บล็อก — ต้องกัน duplicate ที่ application layer (`notification-channel.service.ts` เช็คก่อน insert)

## MariaDB — `notification_deliveries` (CREATE)

Audit trail ทุก send attempt (FR-009) — ครอบคลุมทั้ง DM (มี notification row) และ group post (ไม่มี user notification row)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGINT | PK, AI | รวม `created_at` ใน PK เพื่อ partition (pattern เดียวกับ notifications) |
| `uuid` | UUID | NOT NULL, DEFAULT UUID() | publicId |
| `notification_id` | INT | NULL | notifications.id ถ้าเป็น user notification (ไม่ใส่ FK constraint เพราะ notifications เป็น partitioned table — ใช้ index ธรรมดาตาม pattern เดิม) |
| `channel_type` | ENUM('EMAIL','LINE','TELEGRAM','SYSTEM') | NOT NULL | ช่องทางที่ส่ง |
| `target` | VARCHAR(100) | NOT NULL | chat_id / email / line id ปลายทาง (ไม่เก็บเนื้อข้อความ) |
| `channel_id` | INT | NULL, **no FK** (plain index) | ถ้าส่งผ่าน bound channel (group) — MariaDB ไม่รองรับ FOREIGN KEY บน partitioned table (ค้นพบตอน apply จริง — เหตุผลเดียวกับที่ `notifications`/`audit_logs` ใช้ index ธรรมดาแทน FK) |
| `event_type` | VARCHAR(50) | NOT NULL | เช่น `rfa.pending_approval`, `transmittal.received` |
| `entity_type` / `entity_id` | VARCHAR(50) / VARCHAR(50) | NULL | entity ต้นทาง — entity_id เป็น VARCHAR เพื่อเก็บ publicId (ADR-019) |
| `status` | ENUM('PENDING','SENT','FAILED','SKIPPED') | NOT NULL DEFAULT 'PENDING' | SKIPPED = unreachable/disabled |
| `error_code` / `error_message` | VARCHAR(50) / VARCHAR(500) | NULL | เช่น `BOT_BLOCKED`, `CHAT_NOT_FOUND`, `RATE_LIMITED` |
| `attempt_count` | INT | NOT NULL DEFAULT 0 | จำนวน retry |
| `queued_job_id` | VARCHAR(64) | NULL | BullMQ job id |
| `sent_at` | DATETIME | NULL | เวลาส่งสำเร็จ |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | รวมใน PK + partition key |

`PARTITION BY RANGE (YEAR(created_at))` — pattern เดียวกับ `notifications`/`audit_logs`
Indexes: `(channel_type, status)`, `(channel_id)`, `(target)`, `(entity_type, entity_id)`, `(created_at)`, `(uuid)` — **ทุก UNIQUE index บน partitioned table ต้องมีคอลัมน์ partition key (`created_at`) รวมอยู่** (MariaDB constraint) ดังนั้น `uuid` เป็น index ธรรมดา **ไม่ unique** ที่ระดับ DB (uniqueness บังคับที่ application layer เหมือน `notifications.uuid`)

## Redis (transient — ไม่เข้า MariaDB)

| Key | TTL | Value | ใช้ตอน |
|-----|-----|-------|--------|
| `telegram:link:{token}` | 900s | `{ userId, userPublicId, iat }` | deep-link binding — single-use, DEL หลัง bind สำเร็จ |
| `telegram:webhook:dedup:{update_id}` | 300s | `1` | กัน Telegram webhook retry ซ้ำ (idempotent ingress) |

## BullMQ — queue `notification` (ADR-008)

Job data (Telegram send):

| Field | Type | Notes |
|-------|------|-------|
| `deliveryId` | string (uuid) | notification_deliveries.uuid — source of truth |
| `chatId` | string | snapshot ตอน enqueue |
| `messageThreadId` | number \| null | **[เพิ่มหลัง plan]** จาก `notification_channels.telegram_topic_id` — ถ้าไม่ null ต้องแนบเป็น `message_thread_id` ใน `sendMessage` call เพื่อให้ข้อความเข้า topic ที่ถูกต้อง (ไม่ใส่ field นี้เมื่อส่ง DM ส่วนตัว — ใช้กับ group send เท่านั้น) |
| `text` | string | HTML render แล้ว (templates: `contracts/telegram-message-templates.md`) |
| `idempotencyKey` | string | = delivery uuid |

Worker config: `limiter` ~25 msg/s global + per-chat pacing (~1 msg/s, ≤20 msg/min ต่อ group); `attempts: 5`, `backoff: exponential (5s → 5m)`; permanent errors (403 blocked / 400 chat not found) ข้าม retry →  mark FAILED + flag binding/channel ทันที

## Webhook ingress

`POST /notifications/telegram/webhook` (controller-relative — full external URL คือ `https://api.np-dms.work/api/notifications/telegram/webhook` ตาม global prefix `api` ที่ตั้งไว้ใน `main.ts`, ไม่มี `/v1`) — รับ `X-Telegram-Bot-Api-Secret-Token` (verify กับ system_settings `TELEGRAM_WEBHOOK_SECRET`, is_encrypted=1); จัดการเฉพาะ `message`(/start token, /link code) + `my_chat_member` (bot ถูก add/remove จาก group); ตอบ 200 ทันทีแล้ว defer งานเข้า queue — ห้ามทำงานหนักใน request (ADR-008)

**Forum Topics capture (เพิ่มหลัง plan)**: เมื่อรับ `/link <code>` ต้องอ่าน `update.message.message_thread_id` ถ้ามี (Telegram ใส่ field นี้เฉพาะตอนข้อความถูกส่งในเธรดของ forum topic — group ทั่วไปที่ไม่เปิด Forum mode จะไม่มี field นี้เลย) → เก็บลง `notification_channels.telegram_topic_id`; ถ้าไม่มี field นี้ = `NULL` (ผูกทั้งกลุ่ม)

## Bot token storage

- `system_settings`: `TELEGRAM_BOT_TOKEN` (`category='notification'`, `is_encrypted=1`, `is_public=0`) — primary
- Fallback: docker-compose environment (ห้าม `.env` ใน repo ตาม forbidden table)

## Permission

- Channel bind/unbind/list (`/admin/notifications/channels`): ใช้ `notification.manage_all` (permission id ~155 — มีอยู่ใน seed แล้ว ไม่ต้องเพิ่ม permission ใหม่ใน increment นี้)
- User link/unlink/preference/test-send (ตัวเอง): owner เท่านั้น (CASL: manage own profile, ไม่ต้อง permission พิเศษ — D11a)
- Admin ดู user bindings (column ในตาราง users): `user.view` (มีอยู่แล้ว)
- **Admin force-unlink (`PATCH /users/:uuid` variant หรือ endpoint แยก)**: `user.edit` — permission เดิมที่ gate การแก้ user record (Clarification Q4) **ไม่ใช่** `notification.manage_all` เพราะเป็นการแก้ข้อมูล user resource ไม่ใช่ channel resource
- Admin ดู deliveries/settings (`/admin/notifications/{deliveries,settings}`): `notification.manage_all` เดียวกับ channels (ownership เดียวกัน — admin console ของ feature นี้)

## Significant-status trigger points (corrected — hardcoded, not DSL effect)

**Correction (post-plan)**: `WorkflowEffect`/`EffectSchema` (`backend/src/modules/workflow-engine/dsl/workflow-dsl.schema.ts`) ไม่มี executor รันจริงในระบบ — เป็นแค่ Zod schema validate `workflow_definitions.dsl` (JSON column) เท่านั้น ไม่มีที่ไหนใน codebase interpret `effects[]` แล้วสั่งการจริง การแจ้งเตือนที่มีอยู่ปัจจุบัน (เช่น "notify TO recipient org" ใน `rfa.service.ts`/`correspondence-workflow.service.ts`) เป็น **hardcoded call ตรง** ไปที่ `notificationService.send({type:...})` ทั้งหมด ไม่ผ่าน DSL — สร้าง DSL effect executor ใหม่เกินขอบเขต feature นี้ (เป็นงานของ ADR-001)

**แนวทางที่ใช้จริง**: เพิ่ม call site ตรงที่มีอยู่ (pattern เดียวกับ `EMAIL`/`SYSTEM`) — ตัวอย่างที่พบระหว่างสำรวจโค้ด:

| Event | Call site ปัจจุบัน | สถานะ |
|---|---|---|
| `rfa.pending_approval` | `rfa.service.ts` → `notifyRecipients()` (มี hook อยู่แล้ว ส่ง `SYSTEM`) | เพิ่ม `.send({type:'TELEGRAM'})` ต่อจาก `SYSTEM` call เดิม |
| `transmittal.received`/`correspondence.registered` | `correspondence-workflow.service.ts` → after-commit "Notify TO recipient org" (มี hook อยู่แล้ว ส่ง `EMAIL`) | เพิ่ม `.send({type:'TELEGRAM'})` + `notifyProject()` สำหรับ group |
| `rfa.decision_returned` | **ไม่มี hook อยู่เดิมเลย** (ไม่มีแม้แต่ EMAIL/SYSTEM) — ต้องสร้างใหม่ที่จุด sync terminal state + approveCode (`rfa.service.ts` บริเวณ `isTerminal && approveCodeStr`) | สร้าง hook ใหม่ทั้งหมด (T-task ใน tasks.md จะ pin ตำแหน่งจริงตอน implement) |
| `sla.deadline_reminder` | `reminder.processor.ts` / `escalation.service.ts` (มี hook อยู่แล้ว ส่ง `SYSTEM`) | เพิ่ม `.send({type:'TELEGRAM'})` |
| `correspondence.status_changed` | ไม่มี generic "significant status" hook — ต้องกำหนด allowlist ของ status ที่ significant แล้วเพิ่ม hook ที่จุดเปลี่ยนสถานะ | สร้างใหม่ — allowlist ตัดสินใจตอน implement (เทียบกับ `finalStates` ของ RFA/correspondence workflow) |

**ไม่มี DSL `send_telegram` effect type** — significant status ถูกกำหนดใน code ตรง ๆ (allowlist/if-check) ไม่ใช่ config ที่ประกาศใน `workflow_definitions.dsl`; configurable DSL-driven routing เป็น future work (defer เหมือน "event matrix ใน DB")

## DM Fan-out Resolution (Clarification Q5)

สำหรับ `rfa.decision_returned` และ `correspondence.status_changed` (DM) — recipient resolution logic (ไม่ใช่ single fixed user):

```
recipients = DISTINCT(
  document.created_by,
  SELECT user_id FROM {rfa_workflow | correspondence workflow instance}
    WHERE entity_id = document.id AND assigned_to IS NOT NULL AND status = 'ACTIVE'
)
```

- ดึงจาก `rfa_workflow.assignedTo` (RFA) หรือ workflow instance ที่เทียบเท่าฝั่ง correspondence ณ เวลาที่ event เกิด (ไม่ใช่ snapshot ตอนสร้างเอกสาร)
- แต่ละ recipient ได้ DM แยกกัน (1 notification row + 1 delivery row ต่อคน) — ไม่ใช่ 1 ข้อความหลายคน
- ถ้า recipient คนใดไม่ผูก Telegram หรือปิด `notify_telegram` → skip เฉพาะคนนั้น (ไม่กระทบคนอื่นใน fan-out เดียวกัน)

## State transitions

**User binding:**
```
unlinked → [deep-link + /start] → linked → [user block bot, detected on send] → unreachable (flag ใน delivery log + profile badge)
linked → [user unlink] → unlinked (clear chat_id/username/linked_at)
```

**Channel (group):**
```
(none) → [admin bind] → active → [send fail: bot removed] → inactive + last_error
active → [admin unbind/delete] → row removed (deliveries keep channel_id → SET NULL)
```
