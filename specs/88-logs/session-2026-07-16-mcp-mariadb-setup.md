# Session — 2026-07-16 (MCP MariaDB Setup)

## Summary

ตรวจสอบ MariaDB port exposure ใน docker-compose.yml และแก้ปัญหา MCP MariaDB server เชื่อมต่อไม่ได้ — พบว่า disabled + user ไม่มีใน DB

## ปัญหาที่พบ (Root Cause)

1. **MCP config disabled:** `devin/mariadb` ใน `~/.codeium/windsurf/mcp_config.json` ถูกตั้ง `"disabled": true`
2. **Windsurf เขียนทับไฟล์เอง:** แก้ไฟล์โดยตรงแล้ว Windsurf reset กลับเป็น `disabled: true` ทุกครั้งที่ reload — ต้อง enable ผ่าน Windsurf UI
3. **User `migration_bot` ไม่มีใน MariaDB:** ไม่มี user นี้ใน `mysql.user` — มีแค่ `center`, `gitea`, `root`, `healthcheck`, `mariadb.sys`

## การแก้ไข (Fix)

| ไฟล์/Action | การเปลี่ยนแปลง |
| --- | --- |
| Windsurf UI → MCP Servers | Enable `devin/mariadb` ผ่าน UI (ไม่ใช่แก้ไฟล์โดยตรง) |
| MariaDB (docker exec) | `CREATE USER 'migration_bot'@'%' IDENTIFIED BY 'Center2025'; GRANT ALL PRIVILEGES ON lcbp3.* TO 'migration_bot'@'%'; FLUSH PRIVILEGES;` |

## กฎที่ Lock แล้ว

- **MCP config ต้องแก้ผ่าน Windsurf UI** — ห้ามแก้ไฟล์ `mcp_config.json` โดยตรง เพราะ Windsurf จะเขียนทับ
- **User `migration_bot`** มีสิทธิ์ `ALL PRIVILEGES` บน `lcbp3` เท่านั้น (ไม่สามารถ query `mysql.*` ได้)

## Verification

- [x] `mcp1_mysql_test_connection` — connected: true
- [x] `mcp1_mysql_show_tables` — แสดง ~120 tables ใน `lcbp3`
- [x] `SHOW GRANTS FOR CURRENT_USER()` — `GRANT ALL PRIVILEGES ON lcbp3.* TO migration_bot@%`
- [x] `SELECT User, Host FROM mysql.user` (ผ่าน root) — `migration_bot` @ `%` ปรากฏ
