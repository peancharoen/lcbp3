# Session 2026-08-29 — MCP Config Secret Separation

## Summary

แยก secret (password, API key, token, JWT) ออกจาก `~/.config/devin/mcp_config.json` (user-level global) ย้าย MCP server ทั้งหมดไปไว้ใน `/opt/np-dms-lcbp3/.devin/mcp_config.local.json` (project-level local, gitignored) และเพิ่ม entry ใน `.gitignore` ของ project เพื่อป้องกันการ commit secret

## ปัญหาที่พบ (Root Cause)

- ไฟล์ `~/.config/devin/mcp_config.json` เก็บ secret 5 จุดในรูปแบบ plaintext:
  1. StitchMCP — `X-Goog-Api-Key` ใน args
  2. MariaDB — `MYSQL_PASSWORD` ใน env
  3. Redis — password ฝังใน connection URL
  4. Gitea — `GITEA_TOKEN` ใน env
  5. n8n — `Authorization: Bearer <JWT>` ใน headers
- ไฟล์อยู่นอก project directory ทำให้ไม่มีกลไกป้องกันการ leak ผ่าน backup/sync (เช่น rclone GDrive sync D108)
- ไม่มี separation ระหว่าง config ที่ share ได้กับ secret

## การแก้ไข (Fix)

| ไฟล์                                         | การเปลี่ยนแปลง                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/opt/np-dms-lcbp3/.devin/mcp_config.local.json` | สร้างใหม่ — ย้าย MCP server ทั้ง 10 ตัว จาก user-level config (รวม secret 5 จุด)                        |
| `/home/np-dms/.config/devin/mcp_config.json` | เคลียร์เป็น `{"mcpServers": {}}` (ว่าง — ไม่มี secret หลงเหลือ)                                          |
| `/opt/np-dms-lcbp3/.gitignore`               | เพิ่ม section "Devin MCP local config (contains secrets)" + entry `.devin/mcp_config.local.json` บรรทัด 400 |

## กฎที่ Lock แล้ว

- **D182 — MCP Config Secret Separation**: MCP server config ที่มี secret ต้องเก็บใน `.devin/mcp_config.local.json` (project-level, gitignored) เท่านั้น ไม่ใช่ `~/.config/devin/mcp_config.json` (user-level global); user-level config ต้องเป็น `{"mcpServers": {}}` เปล่า; ใช้กลไก `${env:VAR}` หรือ `${file:/path}` ของ Devin CLI สำหรับ OAuth fields ได้ แต่ env/headers/args อาจไม่ expand (docs ยืนยันเฉพาะ OAuth fields) — ต้องทดสอบก่อนใช้
- MCP server ทั้งหมดจะโหลดเฉพาะตอน cwd อยู่ใน `/opt/np-dms-lcbp3` (Devin walk-up หา `.devin/` จาก cwd)

## Verification

- [x] `git check-ignore -v .devin/mcp_config.local.json` ยืนยัน ignore ผ่าน `.gitignore:400`
- [x] `git status --short` แสดงเฉพาะ `.gitignore` modified — ไฟล์ secret ไม่ปรากฏ (ถูก ignore)
- [x] user-level config `cat ~/.config/devin/mcp_config.json` = `{"mcpServers": {}}` (ว่าง)
- [x] project local config มี server ครบ 10 ตัว (StitchMCP, devin/mariadb, devin/mcp-playwright, redis, qdrant, memory, fetch, gitea, n8n-mcp, cloudflare-docs)
- [ ] Restart Devin CLI เพื่อโหลด config จากที่ใหม่ (session ปัจจุบันยังใช้ config เดิม)
- [ ] ตรวจสอบ `mcp_list_servers` หลัง restart ว่าเห็น server ครบ
- [ ] พิจารณา rotate secret ที่เคยอยู่ใน git history (ถ้าเคย commit มาก่อน — เช็ค `git log --all --full-history -- ~/.config/devin/mcp_config.json`)
