# MCP Redis Tools

MCP Redis server ให้เครื่องมือสำหรับตรวจสอบและจัดการ Redis key-value โดยตรง ใช้สำหรับ:

- Debug ปัญหา caching, rate limiting, และ BullMQ queue โดยไม่ต้องเข้า `redis-cli`
- ตรวจสอบ Redis Redlock state สำหรับ Document Numbering (ADR-002)
- ตรวจสอบ cache invalidation หลังแก้ไขข้อมูล
- ตรวจสอบ session/rate-limit counters

## Available Tools

| Tool     | หน้าที่                              | ตัวอย่างการใช้งาน                                  |
| -------- | ------------------------------------ | ------------------------------------------------- |
| `set`    | ตั้งค่า key-value (มี optional TTL)  | ตั้ง cache key พร้อม `expireSeconds`             |
| `get`    | อ่านค่าจาก key                       | อ่านค่า cache หรือ lock state                     |
| `delete` | ลบ key หนึ่งหรือหลาย key             | ลบ cache ที่ต้องการ invalidate                  |
| `list`   | แสดง keys ที่ตรงกับ pattern (default `*`) | ดู keys ทั้งหมดใน namespace หรือ pattern ใดๆ |

## การใช้งานร่วมกับ Development Flow

**เมื่อ debug caching / cache invalidation:**

1. ใช้ `list` เพื่อหา keys ที่เกี่ยวข้อง (เช่น `list({ pattern: "cache:projects:*" })`)
2. ใช้ `get` เพื่อดูค่าที่เก็บใน cache
3. หลังแก้ไขข้อมูล ใช้ `delete` เพื่อ invalidate cache ที่เกี่ยวข้อง

**เมื่อ debug Document Numbering lock (ADR-002):**

1. ใช้ `list({ pattern: "redlock:*" })` เพื่อดู locks ที่ค้างอยู่
2. ใช้ `get` เพื่อตรวจสอบ lock value (TTL, owner token)
3. หาก lock ค้างผิดปกติ ใช้ `delete` เพื่อคลาย lock (หลังยืนยันว่าไม่มี process ใช้งานอยู่)

**เมื่อ debug BullMQ queue (ADR-008):**

1. ใช้ `list({ pattern: "bull:*" })` เพื่อดู queue keys
2. ใช้ `get` เพื่อตรวจสอบ job state
3. หามี dead-letter jobs ค้าง ใช้ `delete` เพื่อล้าง (ด้วยความระมัดระวัง)

## ข้อควรระวัง

- **❌ ห้ามลบ Redlock key โดยไม่จำเป็น** — อาจทำให้เกิด race condition ใน Document Numbering (ADR-002)
- **⚠️ ระวัง `delete` บน production** — อาจกระทบ cache hit rate และ performance
- **✅ ใช้ `list` ก่อน `delete`** — เพื่อยืนยัน target key ก่อนลบ
- **✅ ตั้ง `expireSeconds` เสมอ** สำหรับ `set` ใหม่ — กัน orphan keys ค้างถาวร
- **⚠️ ห้ามใช้ MCP Redis แทน BullMQ API** — ใช้สำหรับ debug/inspect เท่านั้น ไม่ใช่สำหรับ enqueue/dequeue jobs
- **✅ ใช้ namespace prefix ใน key** — เช่น `cache:`, `redlock:`, `bull:` เพื่อแยกประเภทชัดเจน

## Related Documents

- `specs/06-Decision-Records/ADR-002-document-numbering.md` — Redis Redlock strategy
- `specs/06-Decision-Records/ADR-008-notification-queue.md` — BullMQ queue policy
