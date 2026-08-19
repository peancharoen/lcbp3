# Post-Install Checklist — Server CLI Tools

ใช้หลังรัน `server-tools-setup.sh` เพื่อยืนยันว่าทุกอย่างทำงานถูกต้อง

## apt packages

- [x] `rg --version` แสดงเวอร์ชัน (ripgrep) 15.1.0
- [x] `bat --version` แสดงเวอร์ชัน (ผ่าน symlink `/usr/local/bin/bat`) 0.25.0
- [x] `fd --version` แสดงเวอร์ชัน (ผ่าน symlink `/usr/local/bin/fd`) 10.3.0
- [x] `eza --version` แสดงเวอร์ชัน 0.23.4
- [x] `dust --version` แสดง `Dust x.x.x` (จาก package `du-dust`) 1.2.4
- [x] `duf --version` แสดงเวอร์ชัน 0.9.1
- [x] `fzf --version` แสดงเวอร์ชัน 0.67.0
- [x] `lnav --version` แสดงเวอร์ชัน 0.13.2
- [x] `procs --version` แสดงเวอร์ชัน 0.14.10
- [x] `jq --version` แสดงเวอร์ชัน 1.8.1

## GitHub-release binaries

- [x] `lazydocker --version` แสดงเวอร์ชัน (ไม่ใช่ "command not found") 0.25.2
- [x] `delta --version` แสดงเวอร์ชัน 0.19.2
- [x] `yq --version` แสดง `mikefarah/yq` (go version, ไม่ใช่ python `kislyuk/yq`) 4.53.3
- [x] `which yq` ชี้ไป `/usr/local/bin/yq` (priority สูงกว่า `/usr/bin/yq`)

## Symlinks

- [x] `ls -la /usr/local/bin/bat` → symlink ไป `/usr/bin/batcat`
- [x] `ls -la /usr/local/bin/fd`  → symlink ไป `/usr/bin/fdfind`

## git delta config

- [x] `git config --global --get core.pager` คืนค่า `delta`
- [x] `git config --global --get interactive.diffFilter` คืนค่า `delta --color-only`
- [x] `git config --global --get delta.navigate` คืนค่า `true`
- [x] `git config --global --get delta.line-numbers` คืนค่า `true`
- [x] `git diff` แสดง diff พร้อม line numbers + syntax highlight

## Shell aliases

- [x] `~/.bash_aliases` มีอยู่ และเจ้าของเป็น user ปัจจุบัน
- [x] `source ~/.bashrc` รันได้ไม่มี error
- [x] `type cat` ใน interactive shell บอก `aliased to 'bat --paging=never'`
- [x] `type ls` ใน interactive shell บอก `aliased to 'eza ...'`
- [x] `type lzd` ใน interactive shell บอก `aliased to 'lazydocker'`
- [x] `type lt` ใน interactive shell บอก `aliased to 'lnav'`

## การทำงานจริง (smoke test)

- [x] `rg "TODO" specs/` คืนผลภายใน 1 วินาที
- [x] `fd docker-compose` เจอไฟล์ compose ใน repo
- [x] `dust -d 1 /var/lib/docker` แสดงขนาดโดยไม่ error (ถ้า Docker รันอยู่)
- [x] `lzd` เปิด TUI ได้ (กด q ออก)
- [x] `yq '.services' docker-compose.yml` อ่านค่าได้ (ใช้ไฟล์ compose จริงใน repo)
- [x] `bat specs/README.md` แสดงเนื้อหาพร้อม highlight

## Non-interactive shell ไม่กระทบ

- [x] `bash -c 'type cat'` บอก `/usr/bin/cat` (ไม่ใช่ alias) — ยืนยันว่า script ไม่ได้รับ alias
- [x] cron job หรือ systemd service ที่มีอยู่ยังทำงานปกติ
