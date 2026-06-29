# Session — 2026-06-27 (Gitea SSH via Cloudflare Tunnel)

## Summary

แก้ปัญหา Gitea SSH `Connection refused` / `Network is unreachable` บน New Server (192.168.10.11) ระหว่าง ADR-041 Server Consolidation Migration — ใช้ Cloudflare Tunnel (cloudflared) สำหรับ TCP proxy SSH port 2222 ผ่าน domain `git-ssh.np-dms.work`

## ปัญหาที่พบ (Root Cause)

1. **`ssh: connect to host 192.168.10.11 port 2222: Connection refused`** — สงสัย rootless Gitea ไม่สามารถ bind port 22 ได้ แต่ตรวจสอบจาก QNAP config เดิมพบว่าใช้ `2222:22` และทำงานได้ (Docker ให้ CAP_NET_BIND_SERVICE เป็น default) → config เดิมถูกแล้ว
2. **`ssh: connect to host git.np-dms.work port 2222: Network is unreachable`** — `git.np-dms.work` resolve ไป Cloudflare (104.21.25.150) ซึ่ง proxy แค่ HTTP/HTTPS ไม่รองรับ SSH port 2222

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `02-platform/docker-compose.yml` | (ไม่เปลี่ยน) config เดิม `2222:22` ถูกแล้ว — user ยืนยัน |
| `MIGRATION-PLAN.md` | อัปเดต step 4.7 — บันทึกวิธีแก้ผ่าน Cloudflare Tunnel |
| `git remote origin` | เปลี่ยนจาก `ssh://git@git.np-dms.work:2222/...` → `ssh://git@git-ssh.np-dms.work:2222/np-dms/lcbp3.git` |
| `~/.ssh/config` | เพิ่ม `Host git-ssh.np-dms.work` พร้อม `ProxyCommand cloudflared access ssh --hostname %h` |
| `~/.ssh/known_hosts` | เพิ่ม host key สำหรับ `[git-ssh.np-dms.work]:2222` (คัดลอกจาก `[git.np-dms.work]:2222` — fingerprint เดียวกัน) |

### Cloudflare Tunnel Config (ฝั่ง Server)

เพิ่ม ingress rule ใน Cloudflare Tunnel dashboard:
```yaml
- hostname: git-ssh.np-dms.work
  service: tcp://192.168.10.11:2222
```

## กฎที่ Lock แล้ว

- **Gitea SSH ผ่าน Cloudflare Tunnel:** ใช้ domain `git-ssh.np-dms.work` (แยกจาก `git.np-dms.work` ที่ใช้สำหรับ HTTP/HTTPS) เพราะ Cloudflare proxy ไม่รองรับ SSH port
- **SSH config ProxyCommand:** ทุกการเชื่อมต่อผ่าน `git-ssh.np-dms.work` ต้องใช้ `ProxyCommand cloudflared access ssh --hostname %h`
- **docker-compose port mapping:** `192.168.10.11:2222:22` ถูกต้อง — rootless Gitea ใน Docker สามารถ bind port 22 ใน container ได้ (Docker ให้ CAP_NET_BIND_SERVICE)

## Verification

- [x] `ssh -T git@git-ssh.np-dms.work` → `Hi there, admin! You've successfully authenticated`
- [x] `git remote -v` → `origin ssh://git@git-ssh.np-dms.work:2222/np-dms/lcbp3.git`
- [ ] `2git.ps1` push สำเร็จ (ยังไม่ได้ทดสอบเพราะ nothing to commit)
