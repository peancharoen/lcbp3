# Post-Install Checklist — Server CLI Tools

ใช้หลังรัน `server-tools-setup.sh` เพื่อยืนยันว่าทุกอย่างทำงานถูกต้อง

## apt packages

- [ ] `rg --version` แสดงเวอร์ชัน (ripgrep)
- [ ] `bat --version` แสดงเวอร์ชัน (ผ่าน symlink `/usr/local/bin/bat`)
- [ ] `fd --version` แสดงเวอร์ชัน (ผ่าน symlink `/usr/local/bin/fd`)
- [ ] `eza --version` แสดงเวอร์ชัน
- [ ] `dust --version` แสดง `Dust x.x.x` (จาก package `du-dust`)
- [ ] `duf --version` แสดงเวอร์ชัน
- [ ] `fzf --version` แสดงเวอร์ชัน
- [ ] `lnav --version` แสดงเวอร์ชัน
- [ ] `procs --version` แสดงเวอร์ชัน
- [ ] `jq --version` แสดงเวอร์ชัน

## GitHub-release binaries

- [ ] `lazydocker --version` แสดงเวอร์ชัน (ไม่ใช่ "command not found")
- [ ] `delta --version` แสดงเวอร์ชัน
- [ ] `yq --version` แสดง `mikefarah/yq` (go version, ไม่ใช่ python `kislyuk/yq`)
- [ ] `which yq` ชี้ไป `/usr/local/bin/yq` (priority สูงกว่า `/usr/bin/yq`)

## Symlinks

- [ ] `ls -la /usr/local/bin/bat` → symlink ไป `/usr/bin/batcat`
- [ ] `ls -la /usr/local/bin/fd`  → symlink ไป `/usr/bin/fdfind`

## git delta config

- [ ] `git config --global --get core.pager` คืนค่า `delta`
- [ ] `git config --global --get interactive.diffFilter` คืนค่า `delta --color-only`
- [ ] `git config --global --get delta.navigate` คืนค่า `true`
- [ ] `git config --global --get delta.line-numbers` คืนค่า `true`
- [ ] `git diff` แสดง diff พร้อม line numbers + syntax highlight

## Shell aliases

- [ ] `~/.bash_aliases` มีอยู่ และเจ้าของเป็น user ปัจจุบัน
- [ ] `source ~/.bashrc` รันได้ไม่มี error
- [ ] `type cat` ใน interactive shell บอก `aliased to 'bat --paging=never'`
- [ ] `type ls` ใน interactive shell บอก `aliased to 'eza ...'`
- [ ] `type lzd` ใน interactive shell บอก `aliased to 'lazydocker'`
- [ ] `type lt` ใน interactive shell บอก `aliased to 'lnav'`

## การทำงานจริง (smoke test)

- [ ] `rg "TODO" specs/` คืนผลภายใน 1 วินาที
- [ ] `fd docker-compose` เจอไฟล์ compose ใน repo
- [ ] `dust -d 1 /var/lib/docker` แสดงขนาดโดยไม่ error (ถ้า Docker รันอยู่)
- [ ] `lzd` เปิด TUI ได้ (กด q ออก)
- [ ] `yq '.services' docker-compose.yml` อ่านค่าได้ (ใช้ไฟล์ compose จริงใน repo)
- [ ] `bat specs/README.md` แสดงเนื้อหาพร้อม highlight

## Non-interactive shell ไม่กระทบ

- [ ] `bash -c 'type cat'` บอก `/usr/bin/cat` (ไม่ใช่ alias) — ยืนยันว่า script ไม่ได้รับ alias
- [ ] cron job หรือ systemd service ที่มีอยู่ยังทำงานปกติ
