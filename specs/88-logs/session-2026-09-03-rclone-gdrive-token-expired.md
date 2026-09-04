# Session — 2026-09-03 (rclone Google Drive OAuth Token หมดอายุ)

## Summary

ระหว่างสืบสาเหตุ file-revert phenomenon ใน session อื่นวันเดียวกัน user สงสัยว่า rsync/rclone ไป Google Drive อาจเป็นสาเหตุ — ตรวจแล้วไม่ใช่สาเหตุ revert แต่เจอปัญหาจริงคนละเรื่อง: rclone token หมดอายุมา 4 วันโดยไม่มีใครรู้

## ปัญหาที่พบ (Root Cause)

- Cron 2 ตัวใน crontab: `0 0,12 * * *` (backup repo เต็ม → `gdrive:backups/lcbp3-repo`) และ `0 3,7,11,15,19,23 * * *` (sync specs → `gdrive:shared/lcbp3-specs`)
- `rclone remote gdrive:` เป็น `type=drive` ใช้ OAuth ผู้ใช้ (ไม่ใช่ service account) — token หมดอายุตั้งแต่ **2026-08-30** ทุก run หลังจากนั้นล้มเหลวด้วย `invalid_grant: maybe token expired?` (เช็คใน `/var/log/rclone/specs.log` เจอ error ซ้ำทุก 4 ชม. ต่อเนื่องไม่มีครั้งไหนสำเร็จเลยตั้งแต่วันนั้น)
- **ไม่ใช่สาเหตุของ file-revert** ที่เจอใน session คู่ขนาน — ทิศทาง sync เป็น local→gdrive ทางเดียว (ไม่มีทางเขียนกลับ local ได้แม้จะรันสำเร็จ) และยืนยันด้วยว่าล้มเหลวตั้งแต่ auth ก่อนแตะไฟล์เลย

## การแก้ไข (Fix)

| ขั้นตอน | รายละเอียด |
| --- | --- |
| 1 | User รัน `rclone authorize "drive" "<client-id+secret base64>"` เองบนเครื่องเดียวกัน (ไม่ใช่เครื่องแยกที่มี browser — ใช้ redirect `http://127.0.0.1:53682/` ตรงๆ) ได้ token blob (base64-wrapped JSON) |
| 2 | ลองใช้ interactive `rclone config reconnect gdrive:` paste token เข้า prompt — **ไม่สำเร็จ** ขึ้น `Couldn't decode response - invalid character ' ' in literal null` ซ้ำหลายรอบ (ทั้งจาก agent ป้อนผ่าน stdin และจาก user paste เองในเทอร์มินัล) — ยืนยันว่า blob เองไม่เสีย (decode ผ่าน python json.loads สมบูรณ์) แต่ multi-line interactive paste ไม่เสถียร |
| 3 | เปลี่ยนวิธี: decode blob (`base64 -d` → ดึง field `token` ซึ่งเป็น JSON string ซ้อนอีกชั้น) แล้วใช้ `rclone config update gdrive token "<decoded-inner-json>"` เซ็ตค่าตรงแบบ non-interactive — **สำเร็จ** (ระวัง: `config update` รับชื่อ remote เปล่า ไม่มี `:` ต่อท้าย ต่างจาก `lsd`/`sync` ที่ต้องมี `:`) |
| 4 | Verify: `rclone lsd gdrive:` คืนรายการโฟลเดอร์จริงสำเร็จ; รัน `rclone sync specs gdrive:shared/lcbp3-specs` จริงตามที่ cron ใช้ — โอน 36 ไฟล์ exit 0 |
| 5 | ลบไฟล์ temp ที่มี token/blob ทั้งหมดออกจาก `/tmp` |

## กฎที่ Lock แล้ว

- **D263** — วิธี reconnect rclone OAuth remote ที่ไม่ต้องพึ่ง interactive paste (ซึ่งไม่เสถียรกับ token ยาวๆ): `rclone authorize` (user รันเอง ต้อง browser) → decode ก้อนที่ได้ (`base64 -d | jq/python -r .token`) → `rclone config update <remote-name-no-colon> token "<decoded-json>"`

## Verification

- [x] `rclone lsd gdrive:` สำเร็จ
- [x] `rclone sync specs gdrive:shared/lcbp3-specs` สำเร็จจริง (36 files, exit 0)
- [ ] ยังไม่ได้ทดสอบ cron ตัวที่ 2 (`backup repo เต็ม`) แบบเต็ม — ควรใช้งานได้ปกติในรอบถัดไปเพราะ auth เดียวกัน
- [ ] ตรวจสอบว่าทำไม uptime-kuma push monitor ของ cron ทั้งสองไม่แจ้งเตือนตอน token หมดอายุ 4 วัน — ยังไม่ได้สืบ
