# 145 — Server CLI Tools Setup

## บทสรุป

ติดตั้งและตั้งค่า CLI tools สำหรับ admin/ops บน `np-dms-lcbp3` server (Ubuntu 26.04 LTS) เพื่อให้การดูแลระบบ DMS (Docker/MariaDB/Redis/Qdrant/n8n/Ollama) สะดวกและเร็วขึ้น

## เหตุผล (Motivation)

Server รัน stack ค่อนข้างซับซ้อน (Docker containers หลายตัว + AI workloads + DB) แต่เครื่องมือพื้นฐานที่ติดมากับ OS อ่าน logs/configs/disk usage ได้ลำบาก ทำให้การ debug และ monitor ช้าลง เครื่องมือสมัยใหม่ (Rust/Go single-binary) ช่วยลดเวลาในงาน daily ops ได้มาก

## ขอบเขต (Scope)

### ติดตั้ง (In scope)

| กลุ่ม | Tools | ที่มา |
|------|------|------|
| Search/View | `ripgrep`, `bat`, `fd`, `eza` | apt |
| Disk/Monitor | `du-dust`, `duf`, `procs`, `htop`, `btop`, `ncdu` | apt |
| Logs | `lnav` | apt |
| Fuzzy | `fzf` | apt |
| YAML/JSON | `jq`, `yq` (go version, override apt python yq) | apt + GitHub |
| Docker TUI | `lazydocker` | GitHub release |
| Git diff | `delta` | GitHub release |
| Multiplexer | `tmux` | apt |

### ไม่ติดตั้ง (Out of scope)

- **`sudo-rs`** — ยังไม่มีใน Ubuntu 26.04 repo หลัก ต้อง build เอง เพิ่มพื้นที่ผิดพลาดบน production โดยไม่ได้ประโยชน์ชัดเจน
- **`lazygit`** — TUI git ไม่จำเป็นบน server (ใช้ CLI/Gitea web แทน)
- **`starship`/`zoxide`** — ปรับแต่ง prompt/cd ไม่จำเป็นสำหรับ server admin
- **`age`/`sops`** — project ใช้ env vars + Gitea token อยู่แล้ว ไม่ต้องการ secret manager เพิ่ม

## การตั้งค่า (Configuration)

### Symlinks (Ubuntu renamed binaries)

- `/usr/local/bin/bat` → `/usr/bin/batcat` (Ubuntu หลีกเลี่ยง conflict กับ package `bat` เก่า)
- `/usr/local/bin/fd`  → `/usr/bin/fdfind` (เหตุผลเดียวกัน)

### yq go-version override

- apt ติดตั้ง `yq` เป็น python version (`kislyuk/yq` 3.4.3) ที่ `/usr/bin/yq`
- ติดตั้ง go version (`mikefarah/yq` 4.x) ที่ `/usr/local/bin/yq` (PATH priority สูงกว่า)
- เหตุผล: go version syntax ตรงกับเอกสารส่วนใหญ่ และรองรับ docker-compose manipulation ได้ดีกว่า

### git delta pager

ตั้งค่าใน `~/.gitconfig` ของ user:
```
[core] pager = delta
[interactive] diffFilter = delta --color-only
[delta] navigate = true
        line-numbers = true
```

### Shell aliases

เก็บใน `~/.bash_aliases` (ถูก `~/.bashrc` source อัตโนมัติสำหรับ interactive shell):

| Alias | Target | หมายเหตุ |
|-------|--------|----------|
| `cat` | `bat --paging=never` | override |
| `ls`/`ll`/`la`/`l`/`tree` | `eza ...` | override |
| `du` | `dust` | override |
| `df` | `duf` | override |
| `ps` | `procs` | override |
| `lzd` | `lazydocker` | ใหม่ |
| `lt` | `lnav` | ใหม่ |

## ข้อควรระวัง (Caveats)

1. **alias override คำสั่งมาตรฐาน** — `cat`, `ls`, `du`, `df`, `ps` อาจไม่รองรับ flag ของคำสั่งเดิมทั้งหมด วิธี bypass:
   ```bash
   \cat file.txt         # backslash
   command cat file.txt  # builtin
   /usr/bin/cat file.txt # full path
   ```
2. **alias มีผลเฉพาะ interactive shell** — script/cron/systemd ไม่ได้รับผลกระทบ (เพราะ `~/.bashrc` มี early-return สำหรับ non-interactive)
3. **GitHub API rate-limit** — ถ้าเรียก setup script บ่อยๆ อาจติด rate-limit ให้ใส่ `GITHUB_TOKEN` หรือรอ 1 ชม.
4. **arch = x86_64** — script ดาวน์โหลด binary สำหรับ `x86_64` เท่านั้น ถ้า server เป็น arm64 ต้องแก้ URL

## การใช้งานซ้ำ (Reusability)

```bash
# ติดตั้งครบทุกขั้นตอน (สำหรับเครื่องใหม่)
sudo bash specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh

# ข้าม apt (เครื่องที่ลงไว้แล้ว ต้องการแค่ re-apply config)
bash specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh --skip-apt

# ข้าม alias (ถ้าไม่ต้องการ override คำสั่งมาตรฐาน)
sudo bash specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh --skip-aliases
```

Script เป็น idempotent — รันซ้ำกี่ครั้งก็ได้ผลลัพธ์เดียวกัน

## ไฟล์ที่เกี่ยวข้อง

- `server-tools-setup.sh` — setup script หลัก
- `quickstart.md` — คู่มือเริ่มใช้งานแบบย่อ
- `checklists/post-install.md` — checklist ตรวจสอบหลังติดตั้ง

## อ้างอิง

- `specs/04-Infrastructure-OPS/` — Infrastructure & Operations Guide
- `specs/06-Decision-Records/ADR-010-logging-monitoring-strategy.md` — logging/monitoring strategy
