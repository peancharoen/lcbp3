# Session 2026-08-19 — Server CLI Tools Setup (Feature 145)

## Summary

ติดตั้งและตั้งค่า CLI tools สำหรับ admin/ops บน `np-dms-lcbp3` (Ubuntu 26.04 LTS) พร้อมเก็บ setup script และ documentation ลง repo เพื่อใช้ซ้ำได้เมื่อตั้ง server ใหม่ และเพิ่ม context-aware trigger ใน development-flow rules เพื่อให้ agent รับรู้ว่ามีเครื่องมือเหล่านี้ใช้สำหรับ ops/debug

## ปัญหาที่พบ (Root Cause)

Server รัน stack ซับซ้อน (Docker + MariaDB + Redis + Qdrant + n8n + Ollama) แต่มีเฉพาะเครื่องมือพื้นฐานของ OS ทำให้การ debug/monitor ช้า และไม่มี setup script ที่ทำซ้ำได้สำหรับเครื่องใหม่

ปัญหาระหว่างติดตั้ง:
1. `dust` ไม่มีใน apt ชื่อ `dust` (มีแค่ snap) → ใช้ package `du-dust` แทน
2. `/latest/download/` URL ของ GitHub releases ใช้ไม่ได้ (ชื่อไฟล์ฝัง version) → ต้องดึง version จาก API ก่อน
3. `tar` ใหม่ปิด wildcard โดย default → ต้องเพิ่ม `--wildcards` สำหรับ pattern `delta-*/delta`
4. `yq` ใน apt เป็น python version (`kislyuk/yq` 3.4.3) syntax ต่างจากที่คนส่วนใหญ่ใช้ → ลง go version (`mikefarah/yq` 4.x) ที่ `/usr/local/bin/yq` (PATH priority สูงกว่า)
5. `bat`/`fd` ใน Ubuntu ชื่อ `batcat`/`fdfind` → สร้าง symlink ที่ `/usr/local/bin/`

## การแก้ไข (Fix)

### ติดตั้ง tools บน server

| Tool | ที่มา | หมายเหตุ |
|------|------|----------|
| ripgrep 15.1.0, bat 0.25.0, fd 10.3.0, eza, duf 0.9.1, fzf 0.67.0, lnav 0.13.2, procs 0.14.10, du-dust 1.2.4 | apt | bat/fd ใช้ผ่าน symlink |
| lazydocker 0.25.2 | GitHub release | ดึง version จาก API |
| delta 0.19.2 | GitHub release | ใช้ `--wildcards` ใน tar |
| yq 4.53.3 (go) | GitHub release | override apt python yq |

### Configuration

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `/usr/local/bin/{bat,fd}` | symlink ไป `/usr/bin/{batcat,fdfind}` |
| `~/.gitconfig` | `core.pager=delta`, `interactive.diffFilter=delta --color-only`, `delta.navigate=true`, `delta.line-numbers=true` |
| `~/.bash_aliases` | 9 aliases: `cat`→bat, `ls/ll/la/l/tree`→eza, `du`→dust, `df`→duf, `ps`→procs, `lzd`→lazydocker, `lt`→lnav |

### ไฟล์ใน repo

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh` | สร้างใหม่ — idempotent setup script (171 บรรทัด) พร้อม flags `--skip-apt`/`--skip-aliases`/`--skip-git-delta`/`--help` |
| `specs/100-Infrastructures/145-server-cli-tools/spec.md` | สร้างใหม่ — คำอธิบายงาน + เหตุผล + ขอบเขต + caveats |
| `specs/100-Infrastructures/145-server-cli-tools/quickstart.md` | สร้างใหม่ — คู่มือใช้งานแบบย่อ + ตัวอย่างคำสั่ง + uninstall |
| `specs/100-Infrastructures/145-server-cli-tools/checklists/post-install.md` | สร้างใหม่ — checklist ตรวจสอบหลังติดตั้ง |
| `specs/100-Infrastructures/README.md` | เพิ่มรายการ `145-server-cli-tools` |
| `.devin/rules/08-development-flow.md` | เพิ่ม trigger `"ดู logs / debug ops"` → `145/quickstart.md` |
| `.agents/rules/08-development-flow.md` | sync trigger เดียวกัน |

## กฎที่ Lock แล้ว

- **D112 — Server CLI Tools Setup (Feature 145)**: ใช้ `specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh` เป็น single source of truth สำหรับติดตั้ง CLI tools บน server; script ต้องเป็น idempotent; yq ต้องเป็น go version (`mikefarah/yq`) ไม่ใช่ apt python version; alias มีผลเฉพาะ interactive shell (ไม่กระทบ script/cron/systemd); ห้ามเพิ่ม CLI tools เป็น rule ใน AGENTS.md (เป็น environment state ไม่ใช่ project rule) — ใช้ context-aware trigger ใน `08-development-flow.md` แทน

## Verification

- [x] `bash -n server-tools-setup.sh` syntax ผ่าน
- [x] `--help` แสดง usage ถูกต้อง
- [x] dry-run `sudo bash ... --skip-apt --skip-aliases --skip-git-delta` รันครบทุกขั้นตอน ทุก tool แสดงเวอร์ชันถูกต้อง
- [x] `type cat/ls/ll/tree/du/df/ps/lzd/lt` ใน interactive shell บอก aliased ถูกต้อง
- [x] `bash -c 'type cat'` (non-interactive) บอก `/usr/bin/cat` (ยืนยัน script ไม่กระทบ)
- [x] `git config --global --get core.pager` คืนค่า `delta`
- [x] `which yq` ชี้ `/usr/local/bin/yq` (go version ไม่ใช่ python)
- [x] trigger `"ดู logs / debug ops"` อยู่ในทั้ง `.devin/rules/` และ `.agents/rules/`

## Commits

| Hash | Message |
|------|---------|
| `a3822eb1` | `infra(145): add server CLI tools setup script` (4 files, +447) |
| `8e16f161` | `docs(145): list server-cli-tools in Infrastructures README` |
| `9906130b` | `docs(rules): add "ดู logs / debug ops" context-aware trigger` (2 files, +66/-64) |

## การตัดสินใจสำคัญ

1. **ไม่เพิ่ม CLI tools ใน AGENTS.md** — เป็น environment state ไม่ใช่ project rule; AGENTS.md อยู่ที่ 334 บรรทัดแล้ว ทุกบรรทัดที่เพิ่มเป็น context ที่ agent ต้องอ่านทุก session
2. **ใช้ context-aware trigger แทน** — เป็นแค่ mapping "ถ้าเจอคำพวกนี้ ให้ไปดู quickstart" ไม่ใช่ policy บังคับ; อ้างถึงเอกสารถาวรใน repo ไม่ใช่ environment state
3. **ไม่แนะนำ sudo-rs** — ยังไม่มีใน Ubuntu 26.04 repo หลัก ต้อง build เอง เพิ่มพื้นที่ผิดพลาดบน production โดยไม่ได้ประโยชน์ชัดเจน
4. **yq go version ทับ apt python version** — ใช้ PATH priority (`/usr/local/bin` > `/usr/bin`) ไม่ต้อง uninstall apt version
5. **alias ใน `~/.bash_aliases` ไม่ใช่ `~/.bashrc`** — Ubuntu `.bashrc` source `.bash_aliases` อยู่แล้ว แยก config จาก default file สะอาดกว่า
