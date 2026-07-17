# ติดตั้งและตั้งค่า NUT (Network UPS Tools) สำหรับ CyberPower UT2200EG บน np-dms-lcbp3

## ข้อมูลระบบ

| รายการ | ค่า |
|---|---|
| UPS | CyberPower UT2200EG (USB, Vendor:Product = `0764:0501`) |
| Server | np-dms-lcbp3 (bare-metal Ubuntu) |
| NUT version | 2.8.4 |
| Driver | `usbhid-ups` |
| UPS name ใน NUT | `lcbp3ups` |

---

## 1. ติดตั้ง NUT

```bash
sudo apt update
sudo apt install nut -y
```

ตั้งค่า mode เป็น standalone:

```bash
sudo tee /etc/nut/nut.conf <<'EOF'
MODE=standalone
EOF
```

---

## 2. ตั้งค่า driver (`/etc/nut/ups.conf`)

```ini
[lcbp3ups]
driver = usbhid-ups
port = auto
desc = "CyberPower UT2200EG"

override.battery.charge.low = 20
override.battery.runtime.low = 180
```

**Threshold ที่เลือกใช้:**
- `battery.charge.low = 20%` — trigger shutdown เมื่อแบตเหลือ 20%
- `battery.runtime.low = 180` วินาที (3 นาที) — คำนวณจากเวลาจริงที่วัดได้ตอน `docker compose down` ทั้ง 4 group (~15.5 วินาที) แล้วเผื่อ margin ~12 เท่า สำหรับกรณี load สูงตอนไฟดับจริง

---

## 3. ตั้งค่า upsd (`/etc/nut/upsd.conf`)

```ini
LISTEN 127.0.0.1 3493
MAXCONN 15
```

## 4. สร้าง user สำหรับ upsmon (`/etc/nut/upsd.users`)

```ini
[monuser]
password = <รหัสผ่าน>
upsmon master
```

```bash
sudo chmod 640 /etc/nut/upsd.users
sudo chown root:nut /etc/nut/upsd.users
```

## 5. ตั้งค่า upsmon (`/etc/nut/upsmon.conf`)

```ini
MONITOR lcbp3ups@localhost 1 monuser <รหัสผ่าน> master
MINSUPPLIES 1
SHUTDOWNCMD "/opt/np-dms/scripts/ups-shutdown.sh"
POLLFREQ 5
```

⚠️ **ข้อควรระวังที่เจอจริง:** ตอน setup ครั้งแรกลืมแทนที่ placeholder `ใส่รหัสผ่านของคุณ` ด้วยรหัสผ่านจริง ทำให้ `upsmon` connect ไม่ได้ (`ERR INVALID-ARGUMENT`) ต้องเช็คให้ตรงกับ `upsd.users` เสมอ

---

## 6. แก้ปัญหา USB permission (udev)

### อาการที่เจอ
```
libusb1: Could not open any HID devices: insufficient permissions on everything
```

### สาเหตุ
`systemd-udevd` daemon **ค้าง rule เก่าไว้ในหน่วยความจำตั้งแต่ boot** — คำสั่ง `udevadm control --reload-rules` และ `udevadm trigger` เพียงอย่างเดียว **ไม่พอ** ต้อง restart service จริงถึงจะโหลด rule ใหม่

### วิธีแก้
```bash
sudo systemctl restart systemd-udevd
sudo udevadm trigger --action=add --subsystem-match=usb
sudo udevadm settle
```

### วิธี debug ที่ใช้ได้ผล
```bash
# หา sysfs path ของ device
udevadm info -q path -n /dev/bus/usb/<bus>/<device>

# ทดสอบว่า rule ไหนจะถูกใช้จริง (dry-run)
sudo udevadm test $(udevadm info -q path -n /dev/bus/usb/<bus>/<device>) 2>&1 | grep -i -E "nut|GROUP|rules"
```

Rule ของ CyberPower (`0764:0501`) มีอยู่แล้วใน `/usr/lib/udev/rules.d/62-nut-usbups.rules` บรรทัด 150 — ไม่จำเป็นต้องสร้าง custom rule เพิ่ม

---

## 7. เริ่ม driver ผ่าน systemd (ไม่ใช่ manual)

NUT 2.8.4 ใช้ `nut-driver-enumerator` generate service ต่อ UPS อัตโนมัติ แทนการรัน `upsdrvctl start` ตรงๆ:

```bash
sudo nut-driver-enumerator.sh
systemctl list-units 'nut-driver@*'   # ควรเห็น nut-driver@lcbp3ups.service

sudo systemctl enable --now nut-driver@lcbp3ups.service
sudo systemctl enable --now nut-server
sudo systemctl enable --now nut-monitor
```

### ตรวจสอบ
```bash
sudo upsc lcbp3ups@localhost
```

---

## 8. Shutdown script (`/opt/np-dms/scripts/ups-shutdown.sh`)

Script สั่ง `docker compose down` เรียงลำดับจาก layer บนสุด (AI) ลงไปถึง infrastructure ก่อน shutdown เครื่องจริง:

```bash
#!/bin/bash
# Graceful Docker stack shutdown triggered by NUT on UPS critical battery
set -uo pipefail

LOGFILE=/var/log/ups-shutdown.log
exec >> "$LOGFILE" 2>&1

echo ""
echo "=== UPS shutdown triggered at $(date) ==="

ENVFILE=/opt/np-dms/.env

# Shut down in reverse dependency order: app layer first, infrastructure last
DIRS=(
    "/opt/np-dms/04-ai/ocr-sidecar"
    "/opt/np-dms/03-application"
    "/opt/np-dms/02-platform"
    "/opt/np-dms/01-infrastructure"
)

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "SKIP: $dir does not exist"
        continue
    fi

    echo "--- docker compose down: $dir ---"
    if (cd "$dir" && docker compose --env-file "$ENVFILE" down --timeout 30); then
        echo "OK: $dir"
    else
        echo "WARNING: failed to stop $dir"
    fi
done

echo "=== Docker stack stopped, shutting down system at $(date) ==="
/sbin/shutdown -h +0 "UPS battery critical - automatic shutdown"
```

```bash
sudo chmod 700 /opt/np-dms/scripts/ups-shutdown.sh
sudo chown root:root /opt/np-dms/scripts/ups-shutdown.sh
```

### สาเหตุที่เปลี่ยนจาก dynamic `find` มาเป็น hardcoded path

เวอร์ชันแรกใช้ `find` หา compose file อัตโนมัติในแต่ละ group โดยเก็บชื่อ group ไว้ใน bash array แล้ววน `for group in "${GROUPS[@]}"` — ทดสอบแล้วพบว่า loop รันแค่ 1 รอบแทนที่จะเป็น 4 รอบ (ตัวแปร `$group` ได้ค่าผิดเพี้ยนเป็น `"0"` แทนที่จะเป็น `"04-ai"`) สาเหตุที่แท้จริงไม่ชัดเจน (ไม่ใช่ CRLF, ไม่ใช่ non-ASCII จากการตรวจสอบ) จึงตัดสินใจเปลี่ยนมาระบุ path ของแต่ละ group ตรงๆ ใน array `DIRS` แทน ซึ่งง่ายกว่า, debug ง่ายกว่า และไม่มีปัญหานี้อีก

### สาเหตุที่ต้องเพิ่ม `--env-file`

`docker compose down` ทำ variable interpolation ทั้งไฟล์ compose ตั้งแต่ parse YAML ก่อนจะรู้ด้วยซ้ำว่าจะ down หรือ up — ถ้าไม่ระบุ `--env-file` ให้ตรงกับตอน `up` จะ error เช่น `REDIS_PASSWORD required`, `N8N_DB_PASSWORD required` ทั้งที่ down ไม่จำเป็นต้องรู้ค่าจริงของ secret เหล่านี้เลย

---

## 9. ผูก script เข้ากับ NUT

```bash
sudo sed -i 's|^SHUTDOWNCMD.*|SHUTDOWNCMD "/opt/np-dms/scripts/ups-shutdown.sh"|' /etc/nut/upsmon.conf
sudo systemctl restart nut-monitor
```

⚠️ ระวังการรัน `sed`/`tee -a` ซ้ำหลายครั้งกับไฟล์เดิม อาจทำให้เกิดบรรทัด `SHUTDOWNCMD` ซ้ำกันหลายชุด (เจอจริงระหว่างทำ 3 บรรทัดซ้ำ) ให้เช็คด้วย `grep -n "^SHUTDOWNCMD"` ก่อนเสมอ ถ้าซ้ำให้ลบด้วย:

```bash
sudo awk '!/^SHUTDOWNCMD/ || !seen++' /etc/nut/upsmon.conf > /tmp/fixed.conf
sudo cp /tmp/fixed.conf /etc/nut/upsmon.conf
```

---

## 10. วิธีทดสอบ shutdown flow แบบปลอดภัย (ไม่ต้องถอดปลั๊กจริง)

```bash
# 1. Backup และคอมเมนต์บรรทัด shutdown ชั่วคราว
sudo cp /opt/np-dms/scripts/ups-shutdown.sh /opt/np-dms/scripts/ups-shutdown.sh.bak
sudo sed -i 's|^/sbin/shutdown|# /sbin/shutdown|' /opt/np-dms/scripts/ups-shutdown.sh

# 2. Trigger forced shutdown จำลอง
sudo upsmon -c fsd

# 3. เช็คผล
sudo tail -60 /var/log/ups-shutdown.log
docker ps

# 4. Restore บรรทัด shutdown กลับ + up container คืน
sudo sed -i 's|^# /sbin/shutdown|/sbin/shutdown|' /opt/np-dms/scripts/ups-shutdown.sh

cd /opt/np-dms/01-infrastructure && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/02-platform && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/03-application && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/04-ai/ocr-sidecar && sudo docker compose --env-file ../../.env up -d
```

⚠️ **`upsmon -c fsd` เป็นคำสั่งจริง ไม่ใช่แค่ simulate** — ถ้าลืมคอมเมนต์บรรทัด `/sbin/shutdown` ก่อนรัน เครื่องจะปิดจริงทันที ต้อง comment ออกก่อนทุกครั้งที่ทดสอบ

---

## สรุปผลลัพธ์สุดท้าย

| ส่วน | สถานะ |
|---|---|
| USB permission (udev rule) | ✅ แก้แล้ว |
| `nut-driver@lcbp3ups.service` | ✅ running |
| `nut-server.service` | ✅ running |
| `nut-monitor.service` | ✅ running |
| Auth (`upsd.users` ↔ `upsmon.conf`) | ✅ ตรงกัน |
| Shutdown threshold | ✅ `charge.low=20%`, `runtime.low=180s` |
| Shutdown script | ✅ ทดสอบผ่าน — down ครบ 4 group, `docker ps` ว่างเปล่า |

ระบบพร้อมใช้งานจริง — เมื่อไฟดับและแบตลงถึง threshold ที่ตั้งไว้ เครื่องจะ graceful stop Docker stack ทั้งหมด (เรียงจาก AI layer → Application → Platform → Infrastructure) ก่อน shutdown อัตโนมัติ
