# Quickstart — Server CLI Tools

## ติดตั้ง (ครั้งแรก)

```bash
cd /opt/np-dms-lcbp3
sudo bash specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh
source ~/.bashrc   # เปิดใช้ alias ใน shell ปัจจุบัน
```

## เครื่องมือที่ได้และใช้บ่อย

### ค้นหา/ดูไฟล์

```bash
rg "TODO" specs/                    # ค้นหาข้อความในไฟล์ (เร็วกว่า grep)
rg -t ts "console.log" backend/     # ค้นเฉพาะ TypeScript
fd docker-compose                   # หาไฟล์ชื่อ docker-compose* (เร็วกว่า find)
fd -e yml compose                   # หาไฟล์ .yml ที่ชื่อมี compose
bat specs/README.md                 # อ่านไฟล์พร้อม syntax highlight + line number
bat -r 50:100 file.sql              # อ่านบรรทัด 50-100
```

### ดู disk / process

```bash
dust                                 # หาไฟล์ใหญ่ที่สุดใน cwd (visual)
dust -d 2 /var/lib/docker            # ลึก 2 ระดับ
duf                                  # df แบบตารางสวย
procs                                 # ps แบบ tree
procs ollama                         # ดูเฉพาะ process ชื่อ ollama
btop                                  # top แบบ TUI (กด q ออก)
```

### Docker (lazydocker)

```bash
lzd                                   # เปิด TUI จัดการ Docker
# ภายใน lazydocker:
#   ↑↓ เลือก container, Enter ดู logs, [s] start, [x] stop, [r] restart
#   [c] ดู config, [d] ดู stats, [e] exec shell, q ออก
```

### Logs (lnav)

```bash
lt /var/log/syslog                   # tail พร้อม parse format
lt docker logs -f np-dms-backend     # ตาม log ของ container
# lnav รู้จัก format: Docker JSON, NestJS, syslog, nginx, ฯลฯ
# ภายใน lnav: / ค้นหา, n/N ไป match ถัดไป, q ออก
```

### YAML/JSON

```bash
yq '.services.mariadb.image' docker-compose.yml   # อ่านค่าจาก yaml
yq -i '.services.mariadb.image = "mariadb:11.5"' docker-compose.yml  # แก้
jq '.[] | select(.status=="running")' containers.json
```

### Git (delta สำหรับ diff)

```bash
git diff                             # diff สวยพร้อม line number + syntax highlight
git log -p                           # log พร้อม diff
git show HEAD                        # ดู commit ล่าสุด
```

## วิธี bypass alias เมื่อคำสั่งเดิมจำเป็น

```bash
\cat file.txt                        # cat ดั้งเดิม (ไม่ใช่ bat)
command ps aux                       # ps aux ดั้งเดิม (procs ไม่รองรับ aux)
/usr/bin/du -sh /var                 # du ดั้งเดิม
```

## อัปเดต script หลังแก้

```bash
cd /opt/np-dms-lcbp3
git add specs/100-Infrastructures/145-server-cli-tools/
git commit -m "infra(145): update server CLI tools setup"
```

## ติดตั้งซ้ำบน server ใหม่

```bash
# หลัง clone repo บนเครื่องใหม่
cd /opt/np-dms-lcbp3
sudo bash specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh
source ~/.bashrc
```

## ถอนการติดตั้ง (uninstall)

```bash
# ลบ binary จาก GitHub releases (apt packages ใช้ apt remove แยก)
sudo rm -f /usr/local/bin/{lazydocker,delta,yq,bat,fd}

# ลบ alias
rm -f ~/.bash_aliases

# ลบ git delta config
git config --global --unset core.pager
git config --global --unset interactive.diffFilter
git config --global --unset delta.navigate
git config --global --unset delta.line-numbers

# ลบ apt packages
sudo apt remove -y ripgrep bat fd-find duf fzf lnav procs eza du-dust
```
