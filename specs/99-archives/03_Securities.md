# การตั้งค่า Network Segmentation และ Firewall Rules

สำหรับอุปกรณ์ Omada (ER7206 + OC200) กลยุทธ์หลักคือการใช้ **VLANs (Virtual LANs)** เพื่อแบ่งกลุ่มอุปกรณ์ และใช้ **Firewall ACLs (Access Control Lists)** เพื่อควบคุมการจราจรระหว่างกลุ่มเหล่านั้น

นี่คือคำแนะนำตามแนวทาง "Zero Trust" ที่ปรับให้เข้ากับสถาปัตยกรรมของคุณครับ

---

## 1. 🌐 การแบ่งส่วนเครือข่าย (VLAN Segmentation)

ใน Omada Controller (OC200) ให้คุณไปที่ `Settings > Wired Networks > LAN` และสร้างเครือข่ายย่อย (VLANs) ดังนี้:

- **VLAN 10: SERVER**
  - **IP Range:** 192.168.10.x
  - **วัตถุประสงค์:** ใช้สำหรับอุปกรณ์ Server (QNAP และ ASUSTOR)

- **VLAN 20 MGMT(Default): Management**
  - **IP Range:** 192.168.20.x
  - **วัตถุประสงค์:** ใช้สำหรับอุปกรณ์ Network (ER7206, OC200, Switches) และ PC ของผู้ดูแลระบบ (Admin) เท่านั้น

- **VLAN 30: USER**
  - **IP Range:** 192.168.30.x
  - **วัตถุประสงค์:** สำหรับ PC, Notebook, และ Wi-Fi ของพนักงานทั่วไปที่ต้องเข้าใช้งานระบบ (เช่น `lcbp3.np-dms.work`)

- **VLAN 40: CCTV**
  - **IP Range:** 192.168.40.x
  - **วัตถุประสงค์:** ใช้สำหรับอุปกรณ์ CCTV เท่านั้น

- **VLAN 50 VOICEt**
  - **IP Range:** 192.168.50.x
  - **วัตถุประสงค์:** ใช้สำหรับอุปกรณ์ IP Phone เท่านั้น

- **VLAN 60 DMZ**
  - **IP Range:** 192.168.60.x
  - **วัตถุประสงค์:** ใช้สำหรับ Network DMZ เท่านั้น
- **VLAN 70: GUEST / Untrusted** (สำหรับ Wi-Fi แขก)
  - **IP Range:** 192.168.70.x
  - **วัตถุประสงค์:** สำหรับ Wi-Fi แขก (Guest) ห้ามเข้าถึงเครือข่ายภายในโดยเด็ดขาด

**การตั้งค่า Port Switch:**
หลังจากสร้าง VLANs แล้ว ให้ไปที่ `Devices` > เลือก Switch ของคุณ > `Ports` > กำหนด Port Profile:

- Port ที่เสียบ QNAP NAS: ตั้งค่า Profile เป็น **VLAN 10**
- Port ที่เสียบ PC พนักงาน: ตั้งค่า Profile เป็น **VLAN 20**

---

## 2. 🔥 Firewall Rules (ACLs)

นี่คือหัวใจสำคัญครับ ไปที่ `Settings > Network Security > ACL (Access Control)`

กฎของ Firewall จะทำงานจากบนลงล่าง (ข้อ 1 ทำก่อนข้อ 2)

---

### 2.1 IP Groups & Port Groups

**IP Groups** (สร้างใน `Settings > Network Security > Groups`):

| Group Name         | Members                                           |
| :----------------- | :------------------------------------------------ |
| `Server`           | 192.168.10.8, 192.168.10.9, 192.168.10.111        |
| `Omada-Controller` | 192.168.20.250 (OC200 IP)                         |
| `DHCP-Gateways`    | 192.168.30.1, 192.168.70.1                        |
| `QNAP_Services`    | 192.168.10.8                                      |
| `Internal`         | 192.168.10.0/24, 192.168.20.0/24, 192.168.30.0/24 |
| `Blacklist`        | (Add malicious IPs as needed)                     |

**Port Groups**:

| Group Name   | Ports                                   |
| :----------- | :-------------------------------------- |
| `Web`        | TCP 443, 8443, 80, 81, 2222             |
| `Omada-Auth` | TCP 443, 8043, 8088, 8843, 29810-29814  |
| `VoIP`       | UDP 5060, 5061, 10000-20000 (SIP + RTP) |
| `DHCP`       | UDP 67, 68                              |

---

### 2.2 Switch ACL (สำหรับ Omada OC200)

| ลำดับ | Name                      | Policy | Source            | Destination                   | Ports                                     |
| :---- | :------------------------ | :----- | :---------------- | :---------------------------- | :---------------------------------------- |
| 1     | 01 Allow-User-DHCP        | Allow  | Network → VLAN 30 | IP → 192.168.30.1             | Port Group → DHCP                         |
| 2     | 02 Allow-Guest-DHCP       | Allow  | Network → VLAN 70 | IP → 192.168.70.1             | Port Group → DHCP                         |
| 3     | 03 Allow-WiFi-Auth        | Allow  | Network → VLAN 30 | IP Group → Omada-Controller   | Port Group → Omada-Auth                   |
| 4     | 04 Allow-Guest-WiFi-Auth  | Allow  | Network → VLAN 70 | IP Group → Omada-Controller   | Port Group → Omada-Auth                   |
| 5     | 05 Isolate-Guests         | Deny   | Network → VLAN 70 | Network → VLAN 10, 20, 30, 60 | All                                       |
| 6     | 06 Isolate-Servers        | Deny   | Network → VLAN 10 | Network → VLAN 30 (USER)      | All                                       |
| 7     | 07 Block-User-to-Mgmt     | Deny   | Network → VLAN 30 | Network → VLAN 20 (MGMT)      | All                                       |
| 8     | 08 Allow-User-to-Services | Allow  | Network → VLAN 30 | IP → QNAP (192.168.10.8)      | Port Group → Web (443,8443, 80, 81, 2222) |
| 9     | 09 Allow-Voice-to-User    | Allow  | Network → VLAN 50 | Network → VLAN 30,50          | All                                       |
| 10    | 10 Allow-MGMT-to-All      | Allow  | Network → VLAN 20 | Any                           | All                                       |
| 11    | 11 Allow-Server-Internal  | Allow  | IP Group : Server | IP Group : Server             | All                                       |
| 12    | 12 Allow-Server → CCTV    | Allow  | IP Group : Server | Network → VLAN 40 (CCTV)      | All                                       |
| 13    | 100 (Default)             | Deny   | Any               | Any                           | All                                       |

> ⚠️ **หมายเหตุสำคัญ - ลำดับ ACL:**
>
> 1. **Allow rules ก่อน** - DHCP (#1-2) และ WiFi-Auth (#3-4) ต้องอยู่ **บนสุด**
> 2. **Isolate/Deny rules ถัดมา** - (#5-7) block traffic ที่ไม่ต้องการ
> 3. **Allow specific rules** - (#8-12) อนุญาต traffic ที่เหลือ
> 4. **Default Deny ล่าสุด** - (#13) block ทุกอย่างที่ไม่ match

---

### 2.3 Gateway ACL (สำหรับ Omada ER7206)

| ลำดับ | Name                    | Policy | Direction | PROTOCOLS | Source               | Destination                  |
| :---- | :---------------------- | :----- | :-------- | :-------- | :------------------- | :--------------------------- |
| 1     | 01 Blacklist            | Deny   | [WAN2] IN | All       | IP Group:Blacklist   | IP Group:Internal            |
| 2     | 02 Geo                  | Permit | [WAN2] IN | All       | Location Group:Allow | IP Group:Internal            |
| 3     | 03 Allow-Voice-Internet | Permit | LAN->WAN  | UDP       | Network → VLAN 50    | Any                          |
| 4     | 04 Internal → Internet  | Permit | LAN->WAN  | All       | IP Group:Internal    | Domain Group:DomainGroup_Any |

> 💡 **หมายเหตุ:** Rule #3 `Allow-Voice-Internet` อนุญาต IP Phone (VLAN 50) เชื่อมต่อ Cloud PBX ภายนอก ผ่าน Port Group → VoIP (UDP 5060, 5061, 10000-20000)

---

## 3. 🚪 Port Forwarding (การเปิด Service สู่สาธารณะ)

ส่วนนี้ไม่ใช่ Firewall ACL แต่จำเป็นเพื่อให้คนนอกเข้าใช้งานได้ครับ
ไปที่ `Settings > Transmission > Port Forwarding`

สร้างกฎเพื่อส่งต่อการจราจรจาก WAN (อินเทอร์เน็ต) ไปยัง Nginx Proxy Manager (NPM) ที่อยู่บน QNAP (VLAN 10)

- **Name:** Allow-NPM-HTTPS
- **External Port:** 443
- **Internal Port:** 443
- **Internal IP:** `192.168.10.8` (IP ของ QNAP)
- **Protocol:** TCP

- **Name:** Allow-NPM-HTTP (สำหรับ Let's Encrypt)
- **External Port:** 80
- **Internal Port:** 80
- **Internal IP:** `192.168.10.8` (IP ของ QNAP)
- **Protocol:** TCP

### สรุปผังการเชื่อมต่อ

1. **ผู้ใช้ภายนอก** -> `https://lcbp3.np-dms.work`
2. **ER7206** รับที่ Port 443
3. **Port Forwarding** ส่งต่อไปยัง `192.168.10.8:443` (QNAP NPM)
4. **NPM** (บน QNAP) ส่งต่อไปยัง `backend:3000` หรือ `frontend:3000` ภายใน Docker
5. **ผู้ใช้ภายใน (Office)** -> `https://lcbp3.np-dms.work`
6. **Firewall ACL** (กฎข้อ 4) อนุญาตให้ VLAN 30 คุยกับ `192.168.10.8:443`
7. (ขั้นตอนที่ 3-4 ทำงานเหมือนเดิม)

การตั้งค่าตามนี้จะช่วยแยกส่วน Server ของคุณออกจากเครือข่ายพนักงานอย่างชัดเจน ซึ่งปลอดภัยกว่าการวางทุกอย่างไว้ในวง LAN เดียวกันมากครับ
