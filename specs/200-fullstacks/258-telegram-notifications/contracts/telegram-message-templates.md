# Telegram Message Templates (Contract)

**Feature**: `258-telegram-notifications` | **Date**: 2026-09-25
**Parse mode**: `HTML` (Bot API `sendMessage`) — escape user content ทุก field ก่อนแทรก
**Limit**: ≤ 4096 chars/ข้อความ — ตัดเฉพาะส่วน free-text, ห้ามตัด document number/link
**Link format**: `https://<dms-host>/<module>/<publicId>` — publicId (UUIDv7) เท่านั้น (ADR-019), เปิดแล้วผ่าน auth + CASL ตามปกติ

---

## DM — Personal actionable events

### `rfa.pending_approval` — มีเอกสารรออนุมัติจากคุณ

```html
<b>🔔 มีเอกสารรอการอนุมัติจากคุณ</b>

<b>{documentNumber}</b> — {title}
ผู้เสนอ: {originatorName} ({originatorOrg})
ครบกำหนดตอบ: <b>{dueDate}</b> (เหลือ {daysLeft} วัน)

<a href="{documentUrl}">เปิดเอกสาร →</a>
```

### `rfa.decision_returned` — ผลการอนุมัติ (ส่งกลับผู้เสนอ)

```html
<b>{resultEmoji} {documentNumber} {resultText}</b>

{actionLabel}โดย: {approverName}
เวลา: {decidedAt}
หมายเหตุ: {remark}

<a href="{documentUrl}">เปิดเอกสาร →</a>
```

- `resultEmoji/resultText`: `✅ ได้รับการอนุมัติ` / `❌ ไม่ได้รับการอนุมัติ` / `↩️ ส่งกลับแก้ไข`

### `sla.deadline_reminder` — เตือนกำหนดตอบ

```html
<b>⏰ เตือน: เอกสารใกล้ครบกำหนดตอบ</b>

<b>{documentNumber}</b> — {title}
ครบกำหนด: <b>{dueDate}</b> (เหลือ {daysLeft} วัน)

<a href="{documentUrl}">เปิดเอกสาร →</a>
```

## Group — Project-level events

### `transmittal.received` — Transmittal ใหม่เข้าโครงการ

```html
<b>📥 Transmittal ใหม่ — {projectName}</b>

<b>{documentNumber}</b>
จาก: {originatorOrg}
สถานะ: รอตรวจรับ

<a href="{documentUrl}">ดูรายละเอียด →</a>
```

### `correspondence.registered` — เอกสารใหม่เข้าระบบ

```html
<b>📄 Correspondence ใหม่ — {projectName}</b>

<b>{documentNumber}</b> [{correspondenceType}]
จาก: {originatorOrg}

<a href="{documentUrl}">ดูรายละเอียด →</a>
```

### `correspondence.status_changed` — สถานะเปลี่ยน (เฉพาะ event ที่ทีมต้องรู้)

```html
<b>🔄 อัปเดตสถานะ — {projectName}</b>

<b>{documentNumber}</b>: {oldStatus} → <b>{newStatus}</b>
โดย: {actorName}

<a href="{documentUrl}">ดูรายละเอียด →</a>
```

> **D7 (locked):** Group templates ทั้งหมดเป็น **Minimal** — ไม่ใส่ `{title}` เพราะสมาชิกกลุ่มอาจเป็นคนนอกที่ไม่มีสิทธิ์เห็นเนื้อเอกสาร; DM templates ใส่ `{title}` ได้เสมอ

> **Forum Topics (เพิ่มหลัง plan):** เมื่อ group channel มี `telegram_topic_id` ตั้งไว้ (เช่น topic "Correspondences" ในกลุ่ม "LCBP3") ทุก `sendMessage` call สำหรับ channel นั้นต้องแนบ `message_thread_id: <telegram_topic_id>` เพื่อให้ข้อความไปเข้า topic ที่ถูกต้อง ไม่ตกไปที่ general — เนื้อ template ไม่เปลี่ยน มีผลแค่ parameter ระดับ API call

## Bot replies (ingress)

### `/start` สำเร็จ (binding)

```html
✅ เชื่อมบัญชีสำเร็จ — {displayName}
คุณจะได้รับแจ้งเตือนจาก NAP-DMS ที่นี่
ปิดการแจ้งเตือนได้ในเมนู Preferences ของระบบ
```

### `/start` ไม่มี token / token หมดอายุ

```html
👋 สวัสดี นี่คือบอทแจ้งเตือนของ NAP-DMS
หากต้องการเชื่อมบัญชี กรุณากด "เชื่อม Telegram" ในหน้า Profile ของระบบเพื่อรับลิงก์ใหม่
```

### `/link <code>` ในกลุ่ม (admin bind flow — optional)

```html
✅ ผูกกลุ่มนี้กับโครงการ {projectName} สำเร็จ
```

---

## Field sourcing rules

| Field | Source | Notes |
|-------|--------|-------|
| `documentNumber` | document numbering (ADR-002) | ห้าม truncate |
| `documentUrl` | `{baseUrl}/{module}/{publicId}` | publicId เท่านั้น — ห้าม INT id |
| `originatorOrg` | organizations.name | escape HTML |
| `dueDate`/`daysLeft` | workflow context (ADR-021) | null-safe: ไม่มี due → ตัดบรรทัดออก |
| `remark` | workflow action remark | truncate ≤ 200 chars |
| `projectName` | projects.name | escape HTML |

## i18n

- Templates ทั้งหมดอยู่ใน i18n layer (`t('notification.telegram.<event>')`) — ห้าม hardcode ใน service (ตาม `05-08-i18n-guidelines.md`)
- Default locale: `th`; placeholder names เป็นภาษาอังกฤษ
