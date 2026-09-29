# Feature Specification: Telegram Notifications

**Feature Branch**: `258-telegram-notifications`
**Created**: 2026-09-25
**Status**: Draft
**Governing ADR**: [ADR-057](../../06-Decision-Records/ADR-057-dms-telegram-notification-channel.md) (Draft — D1–D11)
**Input**: User description: "ระบบแจ้งเตือนผ่าน Telegram สำหรับ DMS — ผู้ใช้ผูกบัญชีเพื่อรับ DM, ผูก Telegram group เข้ากับโครงการเพื่อรับแจ้งเตือนระดับทีม, ส่งผ่าน queue ตาม ADR-008, แยก implementation จาก Hermes DevOps bot ตาม ADR-031"

**Boundary (ADR-031 locked decision)**: Telegram สำหรับ DMS ต้องเป็น implementation แยกจาก Hermes DevOps Bridge ทุกประการ — bot คนละตัว, token คนละตัว, permission check ผ่าน CASL Guard ของ DMS API เสมอ

## Clarifications

### Session 2026-09-25

- Q: Correspondence status ไหนถือว่า "significant" สำหรับ event `correspondence.status_changed`? → A: ใช้ mechanism ที่มีอยู่แล้วใน Workflow DSL (`WorkflowEffect.type` enum เช่น `send_email`, `send_line`) — เพิ่ม `send_telegram` เป็น effect type ใหม่; transition ไหนประกาศ effect นี้ไว้ = ถือว่า significant ไม่ต้องเพิ่ม field ใหม่ใน DSL schema
- Q: `digest_mode` มีผลกับ group post ด้วยไหม? → A: ไม่ — digest ใช้กับ DM เท่านั้น; group post ส่ง real-time เสมอ (ไม่มี "owner" คนเดียวให้ digest แทน)
- Q: โครงการหนึ่งผูก Telegram group ได้กี่กลุ่ม? → A: หลายกลุ่มต่อโครงการ (1:N) — ทุกกลุ่มที่ active ได้รับ event ของ project เดียวกันเหมือนกันทั้งหมด (broadcast แบบเดียวกัน ไม่มี per-group routing ใน v1)
- Q: Permission gate สำหรับ action "Unlink Telegram" ในหน้า Admin Users คืออะไร? → A: `user.edit` (permission ที่มีอยู่แล้ว ใช้กับ `PATCH /users/:uuid` ตัวเดียวกับปุ่ม Edit ในตารางเดียวกัน) — คนละ permission จาก `notification.manage_all` ที่ใช้กับ channel management
- Q: `rfa.decision_returned`/`correspondence.status_changed` DM ส่งถึงใครแน่ ๆ ("originator"/"stakeholders")? → A: `created_by` (เจ้าของเอกสาร) รวมกับทุกคนที่มี active workflow assignment บนเอกสารนั้น ณ ขณะเกิด event (multi-recipient — ดึงจาก `rfa_workflow.assignedTo`/เทียบเท่าของ correspondence workflow instance ไม่ใช่แค่คนเดียว)

### Session 2026-09-25 (ต่อ — post-plan, ops feedback)

- Q: ทีมมี Telegram group ที่เปิด Forum Topics (เช่น group "LCBP3" มี topic "Correspondences") — v1 ต้องผูกได้เฉพาะ topic ไม่ใช่ทั้งกลุ่มหรือไม่? → A: ต้องรองรับ — เพิ่ม `notification_channels.telegram_topic_id` (nullable); `/link <code>` ที่พิมพ์ **ในเธรดของ topic** จะพก `message_thread_id` มาใน Telegram update โดยอัตโนมัติ ไม่ต้องมี flow แยก; พิมพ์ใน general chat (ไม่มี topic) → `telegram_topic_id = NULL` = ทั้งกลุ่ม; ส่งข้อความต้องแนบ `message_thread_id` กลับไปหา topic เดิมเสมอ

### Session 2026-09-25 (ต่อ — correction ระหว่าง task planning)

- Q: FR-021 (Clarification Q1) อ้างอิง Workflow DSL effect executor (`send_telegram` ใน `EffectSchema.type`) — พบระหว่างสำรวจโค้ดว่า **executor นี้ไม่มีอยู่จริง**: `EffectSchema`/`WorkflowEffect` เป็นแค่ Zod schema สำหรับ validate `workflow_definitions.dsl` (JSON) ไม่มีที่ไหนใน codebase interpret `effects[]` แล้วสั่งการจริง — การแจ้งเตือนที่มีอยู่ปัจจุบัน (เช่น "notify TO recipient org") เป็น hardcoded call ตรงใน `rfa.service.ts`/`correspondence-workflow.service.ts` ทั้งหมด ไม่ผ่าน DSL เลย จะเอา scope เท่าไหร่ในฟีเจอร์นี้? → A: **ยกเลิก FR-021 เดิม** — ไม่สร้าง DSL effect executor ใน feature นี้ (เป็นการสร้าง missing execution engine ของ ADR-001 เอง ซึ่งเกินขอบเขต); ใช้วิธี hardcode ตรงจุดเหมือนที่ EMAIL/SYSTEM ทำอยู่แล้ว — เพิ่ม `notificationService.send({type:'TELEGRAM'})` ตรงใน call site ที่มีอยู่ (สำหรับ event ที่มี hook อยู่แล้ว) หรือสร้าง hook ใหม่ (สำหรับ `rfa.decision_returned` ที่**ไม่มี hook แจ้งเตือนอยู่เดิมเลยแม้แต่ EMAIL/SYSTEM** — ต้องสร้างใหม่ทั้งหมด); DSL-based configurable routing ถูก defer ไปเป็น future work ของ ADR-001

## User Scenarios & Testing _(mandatory)_

### User Story 1 - User links Telegram and receives personal notifications (Priority: P1)

A DMS user wants approval requests and deadline reminders to reach them on Telegram instead of only email. From their profile page they start the linking flow, get a personal deep link to the DMS Telegram bot, press Start in Telegram, and the account is linked. From then on, events that personally require their action (an RFA waiting on their approval, an upcoming SLA deadline, a result returned to them) arrive as Telegram direct messages with a link back into the DMS.

**Why this priority**: This is the core value — actionable notifications reach users where they actually read them, reducing approval turnaround time. Without DM delivery the feature has no purpose.

**Independent Test**: With one test user, complete the link flow from profile to `/start` in Telegram, trigger one personal event, and verify a DM arrives containing the document number and a working link back to the DMS document page.

**Acceptance Scenarios**:

1. **Given** a logged-in user with no Telegram binding, **When** they start the link flow from their profile, **Then** the system issues a single-use, time-limited deep link that opens the DMS bot in Telegram.
2. **Given** the user presses Start in Telegram via that link, **When** the bot confirms, **Then** the binding is recorded (chat id, username, timestamp) and the user sees "linked" status in their profile.
3. **Given** a linked user, **When** an event occurs that requires their personal action (e.g., RFA assigned for approval), **Then** a Telegram DM is delivered containing the correspondence number, title, sender, due date, and a link to the document.
4. **Given** an RFA decision is returned or a correspondence status changes, **When** the DM fan-out is computed, **Then** recipients are the document's `created_by` (originator) plus every user currently holding an active workflow assignment on that document — not a single fixed recipient.
5. **Given** a link not used within its validity window, **When** the user presses Start on an expired link, **Then** no binding is created and the user is told to generate a new link.
6. **Given** a Telegram account already bound to a different DMS user, **When** a second user tries to bind it, **Then** the binding is rejected with a clear message until the original user unlinks.

---

### User Story 2 - Project team receives shared notifications in a Telegram group (Priority: P1)

A project administrator wants the whole project team to see incoming/outgoing documents in a shared Telegram group. The admin creates a Telegram group, invites the DMS bot, and binds the group to the project from the admin console. From then on, project-level events (new transmittal received, new correspondence registered, document status changes affecting the team) are posted to the group.

**Why this priority**: Team visibility is equally critical — in construction document control, the document controller and engineers must all see new incoming documents promptly. This is the "group" half of the proposed design.

**Independent Test**: Bind one Telegram group to one project, register one transmittal on that project, and verify the group receives the message while other projects' groups do not.

**Acceptance Scenarios**:

1. **Given** an admin with notification management permission, **When** they add the DMS bot to a Telegram group and bind it to a project, **Then** the binding is stored and appears in the admin channel list.
2. **Given** a bound group, **When** a project-level event occurs (e.g., new transmittal received), **Then** the group receives a message with document number, type, originator, and a link to the document (opening it still requires DMS login and proper rights).
3. **Given** two projects each with their own bound group, **When** an event occurs on project A, **Then** only project A's group is notified — no cross-project leakage.
4. **Given** the bot is removed from a bound group, **When** the next delivery attempt fails, **Then** the channel is marked inactive and the admin sees its broken state instead of repeated failures.
5. **Given** an admin unbinds or deactivates a channel, **When** further project events occur, **Then** no messages are sent to that group.

---

### User Story 3 - User controls Telegram preferences and unlinks (Priority: P2)

A user wants to pause Telegram notifications without losing the binding, choose Telegram as their preferred channel, or disconnect entirely. From their preferences they can toggle Telegram on/off and unlink the account; unlinking removes the binding and stops all DMs immediately.

**Why this priority**: User control is required for trust and for the existing preference model (`user_preferences` already governs email/LINE), but the feature still delivers value if shipped after US1/US2.

**Independent Test**: With a linked user, toggle Telegram off and verify no DMs arrive; toggle on and verify delivery resumes; unlink and verify the binding row is cleared and a fresh link flow is required to re-link.

**Acceptance Scenarios**:

1. **Given** a linked user, **When** they disable the Telegram preference, **Then** no Telegram DMs are sent but other enabled channels still deliver.
2. **Given** a user with digest mode enabled, **When** personal DM events accumulate, **Then** Telegram DM delivery follows the same digest behavior as other channels (digest does not apply to project group posts — those always send real-time regardless of any member's digest setting).
3. **Given** a linked user, **When** they unlink, **Then** the binding fields are cleared, DMs stop immediately, and the link flow returns to its initial state.

---

### User Story 4 - Admin observes and manages delivery health (Priority: P3)

An administrator needs to see which users and groups are bound, whether messages are being delivered, and where failures happen. The admin console lists bound channels and per-user bindings, and surfaces delivery failures (user blocked the bot, group removed the bot, Telegram unreachable) so the admin can act.

**Why this priority**: Operability matters for production, but the feature can ship its first increment without a full health dashboard as long as failures are logged for audit.

**Independent Test**: Cause a delivery failure (blocked bot) and verify it appears in delivery records and admin views with a readable reason.

**Acceptance Scenarios**:

1. **Given** a delivery that fails because the user blocked the bot, **When** the failure is recorded, **Then** the user's binding is flagged unreachable and subsequent sends to that user are skipped without repeated errors.
2. **Given** an admin viewing the channel list, **When** they open it, **Then** each bound group shows its project, status, and last delivery result.
3. **Given** any send attempt, **When** it completes or fails, **Then** an auditable record exists showing recipient, event, and outcome.

---

### Edge Cases

- User presses `/start` in the bot without a valid token → bot replies with instructions only; no binding is created.
- Link token replayed after successful use → rejected (single-use).
- User blocks the bot after linking → next DM fails; binding flagged unreachable; no retry storm.
- Bot kicked from a bound group → channel marked inactive on next failed send; admin notified via system notification.
- Same Telegram user tries to bind two DMS accounts → second binding rejected (one chat id binds to at most one DMS user).
- Message body exceeds the platform length limit → system truncates the free-text portion, never the document number or link.
- Telegram API unreachable or rate-limited → delivery is retried by the queue with backoff; a permanently failing message lands in a failed state, not an infinite loop.
- Project deleted or user deactivated → bound channels/bindings stop receiving; bindings on deleted projects are cleaned or flagged.
- Event content contains characters that break message formatting → system escapes content before sending; a malformed payload must never crash the sender.
- Bot token missing/expired → the whole Telegram channel degrades gracefully: events still deliver via email/LINE/SYSTEM and admin sees Telegram as unavailable.
- Concurrent events burst (e.g., bulk transmittal import) → queue paces sends within platform rate limits rather than dropping or erroring.
- Hermes DevOps bot exists on the same network → this feature uses its own bot token and its own ingress path; no shared credentials or handlers (ADR-031).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST let an authenticated DMS user generate a single-use, time-limited deep link to bind their Telegram account, and MUST create the binding (chat id, optional username, link timestamp) only after the user starts the bot through that link.
- **FR-002**: System MUST deliver Telegram direct messages to bound users for events requiring their personal action (approval assigned, decision returned, SLA/deadline reminders), subject to their notification preferences.
- **FR-003**: System MUST let an authorized administrator bind a Telegram group to a project and unbind/deactivate it, with the binding recorded as a manageable notification channel.
- **FR-004**: System MUST deliver messages to bound project groups for project-level events (new incoming/outgoing correspondence, transmittals, and status changes designated as team-visible).
- **FR-005**: System MUST guarantee project isolation: a group bound to project A MUST never receive project B's events. A project MAY have multiple active bound groups (1:N); all active groups bound to the same project MUST receive identical event broadcasts — no per-group event routing in v1.
- **FR-006**: Users MUST be able to enable/disable Telegram delivery and unlink their account; unlinking MUST clear the binding and stop DMs immediately.
- **FR-007**: System MUST respect existing notification preferences (channel on/off, digest mode) for DM delivery so Telegram DMs behave consistently with EMAIL/LINE channels; digest mode does NOT apply to project group posts (group delivery is always real-time, independent of any member's preference).
- **FR-008**: Every outbound message MUST be sent through an asynchronous queued job with retry/backoff and rate limiting; no send may block a user-facing request (ADR-008).
- **FR-009**: System MUST record every send attempt's outcome (delivered/failed + reason) in an auditable delivery log.
- **FR-010**: System MUST detect permanent failures (user blocked bot, bot removed from group, chat not found) and mark the binding/channel unreachable or inactive, skipping further sends until re-linked or re-enabled.
- **FR-011**: All document links inside messages MUST use `publicId` (UUIDv7) — never internal INT ids (ADR-019) — and opening them MUST still enforce normal DMS authentication and CASL authorization.
- **FR-012**: The bot token and any webhook secret MUST be stored outside source control — via encrypted system setting or deployment environment — and MUST never appear in logs or committed files.
- **FR-013**: This feature MUST be a separate implementation from the Hermes DevOps Telegram bridge (ADR-031): separate bot, separate token, separate ingress endpoint, DMS-side CASL checks.
- **FR-014**: Message content MUST be escaped/sanitized before sending and MUST be truncated safely when exceeding platform limits, preserving document number and link.
- **FR-015**: If Telegram configuration is absent or the platform is down, the system MUST continue delivering via remaining enabled channels and surface Telegram as unavailable to admins — never silently dropping notifications.
- **FR-016**: `notifications.notification_type` MUST accept `TELEGRAM` so Telegram deliveries are recorded consistently with other channels.
- **FR-017**: The profile notifications UI MUST persist all channel preferences (email, LINE, Telegram, digest) through the preferences API — no client-only/mock state may remain.
- **FR-018**: The admin user list MUST display each user's Telegram binding status and MUST allow admins holding the existing `user.edit` permission (same permission that gates editing a user record) to force-unlink with confirmation, an audit entry, and a system notification to the affected user.
- **FR-019**: An admin notifications section MUST provide pages for channel management (bind/unbind/activate state), delivery audit logs, and bot status (token presence shown masked — never editable or readable in plaintext via UI).
- **FR-020**: Users MUST be able to send a test message to their bound Telegram from their profile to verify delivery and surface unreachable state.
- **FR-021** *(superseded — see Clarifications correction)*: ~~Workflow DSL `send_telegram` effect~~. **Corrected**: System MUST trigger Telegram notifications for significant state transitions via direct calls at the existing notification call sites (same pattern as current `EMAIL`/`SYSTEM` sends in `rfa.service.ts`/`correspondence-workflow.service.ts`), and MUST add a new call site for `rfa.decision_returned` (no existing hook for any channel today). A DSL-driven configurable executor is out of scope for this feature (tracked as future work under ADR-001).
- **FR-022**: DM fan-out for `rfa.decision_returned` and `correspondence.status_changed` MUST resolve to the document's `created_by` plus every user holding an active workflow assignment on that document at event time — never a single hardcoded recipient.

### Key Entities _(include if feature involves data)_

- **User Telegram binding**: per-user link to a Telegram chat — chat id (send target), username (display only), linked timestamp; at most one DMS user per chat id.
- **Notification channel**: a bindable external destination — type (Telegram group/channel, future LINE), external chat id, owning project (null = global scope), display name, active flag.
- **Notification preference** (existing): extended with a Telegram on/off flag; digest mode shared across channels.
- **Notification record** (existing): extended to accept TELEGRAM as a delivery type so sends are auditable like EMAIL/LINE/SYSTEM.
- **Link token** (transient): single-use, short-lived binding ticket — stored outside the database (cache) with expiry.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can complete Telegram linking in under 2 minutes from profile to confirmed binding.
- **SC-002**: 95% of triggered notifications are delivered to Telegram within 30 seconds of the originating event under normal load.
- **SC-003**: Delivery success rate to reachable recipients is ≥ 99%; permanent-failure recipients are detected and excluded within one failed attempt.
- **SC-004**: Zero cross-project leakage: in testing, no bound group ever receives another project's event (audited over the full event set).
- **SC-005**: A user can disable Telegram delivery or unlink in under 1 minute, and DMs stop within the next send cycle.
- **SC-006**: During a burst of 500 queued notifications, none are lost and sends remain within platform rate limits without manual intervention.

## Assumptions

- One DMS bot serves the whole system (not per project); separation by project is achieved via per-project group bindings.
- A Telegram channel type for broadcast is out of scope for the first increment; groups cover team visibility, DMs cover personal action.
- Interactive bot commands beyond `/start` linking (e.g., approve-in-Telegram) are out of scope — messages carry links into the DMS where CASL applies.
- Inbound webhook ingress terminates on the existing DMS backend behind TLS with a secret token; no separate service is introduced.
- Thai is the default message language; message templates live in the i18n layer like all user-facing text.

## Locked Decisions (grill session 2026-09-25)

- **D1 — Ingress**: Webhook ผ่าน Cloudflare Tunnel (sole edge proxy ตาม ADR-045) + verify `X-Telegram-Bot-Api-Secret-Token` — ไม่ใช้ long polling (หลีกเลี่ยง single-consumer/leader-election complexity)
- **D2 — User binding UX**: Deep link `t.me/<bot>?start=<token>` จาก Profile → Notifications tab; toggle `notify_telegram` disabled จนกว่าผูกสำเร็จ; QR code ของลิงก์เป็น enhancement ภายหลัง
- **D3 — Group binding UX**: `/link <code>` ในกลุ่มเป็น primary (โค้ด single-use, TTL 15 นาที, ผูก project ที่ admin เลือกไว้ล่วงหน้า); unbind/deactivate ผ่าน admin console เท่านั้น ไม่มี `/unlink` ในกลุ่ม; **รองรับ Forum Topics** — ถ้าพิมพ์ `/link` ในเธรดของ topic เฉพาะ (เช่น "Correspondences" ใน group "LCBP3") การผูกจะเจาะจงถึง topic นั้น (`telegram_topic_id` จาก `message_thread_id`); พิมพ์ใน general chat = ผูกทั้งกลุ่ม (`telegram_topic_id = NULL`)
- **D4 — Group routing**: `notifyProject(projectId, eventType, payload)` API ใหม่ — producer ที่มี project context เรียกตรง ๆ ไม่ auto-derive จาก entity
- **D5 — Event catalog**: fixed catalog ใน v1 ตามตารางด้านล่าง

| Event | DM | Group |
|---|---|---|
| `rfa.pending_approval` | ✅ approver | — |
| `rfa.decision_returned` | ✅ created_by + active assignees (multi-recipient) | — |
| `sla.deadline_reminder` | ✅ owner | — |
| `transmittal.received` | ✅ doc controller | ✅ project group |
| `correspondence.registered` | — | ✅ project group |
| `correspondence.status_changed` | ✅ created_by + active assignees (multi-recipient) | ✅ project group (เฉพาะ transition ที่ hardcode ไว้ในโค้ด — ดู Clarifications correction, ไม่ใช่ DSL effect) |

- **D6 — Admin user management**: หน้า `/admin/access-control/users` เพิ่ม column "Telegram" (`✈️ @username` / `⚠️ blocked` / `—`) + action "Unlink Telegram" (เฉพาะ user ที่ผูก) พร้อม confirm + audit log + system notification แจ้ง user ("บัญชี Telegram ของคุณถูกยกเลิกการเชื่อมโดยผู้ดูแลระบบ"); admin ผูกแทน user ไม่ได้ (platform constraint)
- **D7 — Group message detail level**: Minimal — group post แสดงเฉพาะ เลขที่ + ประเภท + org ผู้ส่ง + ลิงก์ (**ไม่มี title**) เพราะสมาชิกกลุ่มอาจเป็นคนนอกที่ไม่มีสิทธิ์เห็นเนื้อเอกสาร; DM แสดง full detail ได้เสมอ (ผู้รับ = เจ้าของสิทธิ์); upgrade เป็น per-channel config เป็น deferred item ถ้าทีมต้องการ
- **D8 — Admin nav**: section ใหม่ `/admin/notifications/*` — `channels` (bound groups CRUD), `deliveries` (audit log), `settings` (bot status masked + global enable/disable); ไม่มีหน้าแก้ token บน UI (ค่าอยู่ใน `system_settings` encrypted เท่านั้น)
- **D9 — Preferences wiring**: หน้า Profile → Notifications ที่เป็น mockup อยู่ wire เข้า `GET/PATCH /users/me/preferences` ทั้งหมด (email, line, telegram, digest) — ไม่เหลือ toggle หลอก; `UpdatePreferenceDto` + `notify_telegram`
- **D10 — User preference granularity**: `notify_telegram` เป็น master switch เดียว (on/off) — ไม่มี per-event toggles ใน v1; per-event preference รวมอยู่ใน deferred "event matrix ใน DB"
- **D11 — Defaults roundup (2026-09-25)**:
  - a. ผูกได้ทุก authenticated user (self-service, ไม่ต้อง permission พิเศษ)
  - b. ข้อความภาษาไทยอย่างเดียว (v1) — templates ใน i18n layer พร้อมขยาย
  - c. โปรไฟล์แสดงสถานะ unreachable `⚠️` เมื่อ user block bot
  - d. ปุ่ม "ส่งข้อความทดสอบ" เมื่อผูกแล้ว (verify delivery + ชี้ unreachable)
  - e. User inactive/deleted → binding เก็บไว้แต่ delivery skip; reactivate แล้วใช้ต่อได้
  - f. Delivery log cleanup 90 วัน (เหมือน notifications เดิม)
  - g. Link-gen endpoint: `ThrottlerGuard` + `Idempotency-Key`
  - h. Channel bind ใช้ permission `notification.manage_all` เดิม (ไม่เพิ่ม seed permission)
  - i. Webhook = public path + secret-token verify + ตอบ 200 ทันที defer เข้า queue
  - j. Bot `@LCBP3DMSBot` (placeholder) — ops สร้างผ่าน BotFather, token ใน `system_settings` encrypted

## Deferred (บันทึกไว้พิจารณาภายหลัง — ไม่ใช่ scope v1)

- **Event matrix ใน DB**: admin-configurable routing ว่า event ไหน → channel ไหน/กลุ่มไหน ต่อ project (แทน fixed catalog)
- **Event catalog ขยาย**: event type เพิ่มเติมนอกเหนือ 6 รายการใน D5 (เช่น circulation, drawing review, migration events)
- **Auto-detect group binding**: list กลุ่มที่ bot ถูกเชิญเข้าแต่ยังไม่ผูก (เสริม D3 — ลด friction)
- **QR code สำหรับ link flow**: scan ผูกด้วยมือถือโดยไม่ต้อง login Telegram บนเครื่องเดียวกัน
- **Telegram Channel (broadcast)**: ประกาศทางการแบบ one-way
- **Interactive commands**: `/unlink`, `/status`, approve-in-Telegram — ต้องผ่าน design เพิ่มเติมเรื่อง CASL + audit
