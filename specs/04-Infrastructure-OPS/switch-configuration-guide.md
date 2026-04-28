# Switch Configuration Guide — Omada SDN V6

**Version:** 3.0
**Last Updated:** 2026-04-24
**Status:** Production
**Author:** Infrastructure Team
**Maintainer:** NAP-DMS DevOps
**Scope:** LCBP3 Network Infrastructure (SG3210X-M2 + SG2428P)

---

## Table of Contents

1. [Overview](#overview)
2. [VLAN Definitions](#vlan-definitions)
3. [Port Profiles](#port-profiles)
4. [VLAN Mapping](#vlan-mapping)
5. [Network Diagram](#network-diagram)
6. [Configuration Procedure](#configuration-procedure)
7. [Change Log](#change-log)
8. [Quick Reference](#quick-reference--edit-port-values)
9. [Pre-Deployment Checklist](#pre-deployment-checklist)
10. [Testing Guide](#testing-guide--vlan--lacp--stp)
11. [Security & Optimization](#security--optimization-recommended)
12. [Related Documents](#related-documents)

---

## Overview

เอกสารนี้กำหนด Port Profile templates และ VLAN mapping configuration สำหรับ LCBP3 network infrastructure โดยใช้ TP-Link Omada SDN V6 Controller (OC200)

**Audience:** Network Administrator, DevOps Engineer
**Prerequisites:** Omada SDN Controller v6.x, สิทธิ์ Admin บน OC200
**Related ADRs:** ADR-016 (Security), ADR-009 (Database Strategy — ถ้ามี Network DB)

### Network Equipment

| Device | Model | Role |
|--------|-------|------|
| Core Switch | SG3210X-M2 | 10G Core Switch |
| Access Switch | SG2428P | PoE Access Switch |
| NAS Storage | QNAP / ASUSTOR | Network Attached Storage |
| Unmanaged Switch 1 | TL-SG1210P | IP Phone + PC |
| Unmanaged Switch 2 | TL-SL1226P | CCTV |
| Wireless AP | EAP610 | Wi-Fi Access Points |
| Router | ER7206 | Edge Router |

### Configuration Concepts

**Port Profile** — Template defining port-level settings (STP Security, Loopback Control, Multicast Fast Leave, Flow Control, EEE, LLDP-MED, PoE). Port Profiles do NOT contain VLAN configuration.

**Edit Port** — VLAN assignment step where Native Network (Untagged), Tagged Network, and Voice Network are configured, and a Port Profile is applied.

---

## 🧠 Key Concepts (Before Using This Config)

- ใช้ **STP เท่านั้น (เลิก Loop Detection)** — Spanning Tree Protocol สำหรับ loop prevention
- **Harden Access Port ด้วย BPDU Guard** — ป้องกันการเสียบ switch โดยไม่ได้รับอนุญาต
- **กัน Rogue Switch ด้วย Root Guard** — ป้องกัน switch เถื่อนยึด root bridge
- **ทำ Trunk ให้ clean + predictable** — Native VLAN 20 สำหรับทุก trunk port (รวมถึง Management)
- **เผื่อ future VLAN expansion** — รองรับ VLAN เพิ่มเติมในอนาคต
- **VLAN 20** — Native VLAN สำหรับ Trunk และ Management (รวมศูนย์กลางที่เดียว)

---

## VLAN Definitions

| VLAN ID | Name | Purpose | Subnet | Gateway | DHCP Range |
|---------|------|---------|--------|---------|-------------|
| 10 | NAS-ADMIN | NAS Storage & Admin Desktop | 192.168.10.0/24 | 192.168.10.1 | 192.168.10.50–199 |
| 20 | MGMT | Network Management (OC200) | 192.168.20.0/24 | 192.168.20.1 | 192.168.20.50–199 |
| 30 | USERS | User PCs, Printers, Staff WiFi | 192.168.30.0/24 | 192.168.30.1 | 192.168.30.50–199 |
| 40 | CCTV | CCTV Cameras, IoT Devices | 192.168.40.0/24 | 192.168.40.1 | 192.168.40.50–199 |
| 50 | VOICE | IP Phones | 192.168.50.0/24 | 192.168.50.1 | 192.168.50.50–199 |
| 70 | GUEST | Guest WiFi | 192.168.70.0/24 | 192.168.70.1 | 192.168.70.50–199 |
| 999 | UNUSED | Reserved (was NATIVE) — ไม่ใช้แล้ว | — | — | — |
| 60 | UNUSED | Reserved for future use | — | — | — |

---

## Port Profiles

### Profile 1 — 001-CORE-TRUNK-LACP 🔷

**Purpose:** LACP trunk links between Core and Access switches / Router

**Applied To:**
- SG3210X-M2 Port 1–2 (to SG2428P Port 21–22)
- SG3210X-M2 Port 9 (to ER7206)
- SG2428P Port 21–22 (to SG3210X-M2 Port 1–2)

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: DISABLE (Trunk ไม่ใช่ Edge Port)
  - Spanning Tree Config:
    - Loop Protect: ENABLE (ป้องกัน Loop จากอุปกรณ์ที่อยู่เบื้องหลัง)
    - Root Protect: DISABLE
    - TC Guard: DISABLE
    - BPDU Protect: DISABLE
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: DISABLE
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```

📌 **ใช้กับ:** Core ↔ Access, Core ↔ Router
**Bandwidth Control:** Trunk หลักต้องรับส่ง Traffic สูง ห้ามจำกัด Rate → Storm Control ป้องกัน Broadcast Storm โดยไม่กระทบ Throughput ปกติ
---

### Profile 2 — 002-NAS-LACP 🔷

**Purpose:** LACP links to NAS storage devices (QNAP / ASUSTOR)

**Applied To:**
- SG3210X-M2 Port 3–4 (to QNAP)
- SG3210X-M2 Port 5–6 (to ASUSTOR)

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: DISABLE (Trunk ไม่ใช่ Edge Port)
  - Spanning Tree Config:
    - Loop Protect: ENABLE (ป้องกัน Loop จากอุปกรณ์ที่อยู่เบื้องหลัง)
    - Root Protect: DISABLE
    - TC Guard: DISABLE
    - BPDU Protect: DISABLE 🔥 (NAS บางรุ่นส่ง BPDU แปลก ๆ → ห้ามเปิด)
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: DISABLE
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```

⚠️ **เหตุผล:** NAS บางรุ่นส่ง BPDU แปลก ๆ → ห้ามเปิด BPDU Guard
**Bandwidth Control:** NAS ต้องการ Throughput สูง (2Gbps LACP) → Rate Limit จะลดประสิทธิภาพการ Transfer ไฟล์ → Storm Control ปลอดภัยกว่า
---

### Profile 3 — 003-UNMANAGED-SWITCH 🔷⭐ (สำคัญมาก)

**Purpose:** Downstream links to unmanaged switches — ป้องกัน Rogue Switch

**Applied To:**
- SG2428P Port 25 (to TL-SL1226P — CCTV)
- SG2428P Port 26 (to TL-SG1210P — IP Phone + PC)

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: DISABLE (Trunk ไม่ใช่ Edge Port)
  - Spanning Tree Config:
    - Loop Protect: ENABLE (ป้องกัน Loop จากอุปกรณ์ที่อยู่เบื้องหลัง)
    - Root Protect: ENABLE 🔥🔥🔥 (สำคัญสุด — ป้องกัน switch เถื่อนยึด root)
    - TC Guard: DISABLE
    - BPDU Protect: DISABLE (Unmanaged Switch ส่งต่อ BPDU ได้ → ใช้ Root Protect แทน)
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: DISABLE
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```

📌 **ป้องกัน:** เสียบ switch เถื่อน → ยึด root ไม่ได้
**Bandwidth Control:** สำคัญสุด! Unmanaged Switch ส่งต่อ Broadcast ได้ → ต้องมี Storm Control เพื่อป้องกัน Loop/Storm จากอุปกรณ์ที่อยู่เบื้องหลัง

---

### Profile 4 — 004-AP-TRUNK 🔷

**Purpose:** Trunk links to wireless access points (EAP610)

**Applied To:**
- SG2428P Port 1–16 (to EAP610)

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: ENABLE (AP เป็น Edge Device)
  - Spanning Tree Config:
    - Loop Protect: DISABLE (AP ไม่ควรส่ง BPDU)
    - Root Protect: DISABLE
    - TC Guard: DISABLE
    - BPDU Protect: ENABLE 🔥 (ใช้คู่กับพอร์ตประเภทขอบเครือข่าย (Edge Port) ที่เชื่อมต่อกับอุปกรณ์ปลายทางเท่านั้น เช่น เครื่อง PC, เครื่องพิมพ์ หรือ Access Point)
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: ENABLE
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```
📌 **หมายเหตุ:** AP ไม่ควรส่ง BPDU → เปิด guard ได้
**Bandwidth Control:** AP มี WiFi Management Traffic, Multicast → Storm Control 1%/2% เพียงพอ (เอกสาร Security Section ยืนยันแล้ว)
---

### Profile 5 — 005-VOICE-ONLY 🔷

**Purpose:** Direct connections to IP phones (Port 1 Uplink) — Port 2 LAN สำหรับ PC

**Applied To:**
- SG2428P Port 17–18 (to IP Phone Port 1 — Uplink)

**IP Phone Internal Structure:**
```
Switch Port 17/18 ──► [IP Phone]
                       ├── Port 1 (Uplink) ← รับ Voice VLAN 50
                       └── Port 2 (LAN)    ← ต่อ PC (Data VLAN 30)
```

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: ENABLE 🔥 (พอร์ตขอบเครือข่ายที่เชื่อมต่ออุปกรณ์ปลายทาง)
  - Spanning Tree Config:
    - Loop Protect: DISABLE (IP Phone ไม่ควรส่ง BPDU)
    - Root Protect: DISABLE
    - TC Guard: DISABLE
    - BPDU Protect: ENABLE 🔥 (IP Phone Isolate BPDU จาก Port 2 → ปลอดภัย)
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: ENABLE 🔥 (จำเป็นสำหรับ Voice VLAN)
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```
**Bandwidth Control:** IP Phone ใช้ Bandwidth ต่ำ (G.711 ~87kbps) แต่ Storm Control ป้องกันกรณี Firmware Bug/Loop

⚠️ **หมายเหตุสำคัญ:** IP Phone มี Port 2 สำหรับต่อ PC — IP Phone จะ **Isolate BPDU** จาก Port 2 ไม่ให้ส่งถึง Switch หลัก → BPDU Guard ใช้ได้ปลอดภัย
---

### Profile 6 — 006-ACCESS-PC 🔷⭐

**Purpose:** Direct connections to PCs and printers — Hardened Access Port

**Applied To:**
- SG2428P Port 23 (to Printer)
- SG3210X-M2 Port 8 (to Admin Desktop)
- General PC connections

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: ENABLE 🔥🔥🔥 (สำคัญสุด — พอร์ตขอบเครือข่าย)
  - Spanning Tree Config:
    - Loop Protect: DISABLE (PC/Printer ไม่ควรส่ง BPDU)
    - Root Protect: DISABLE
    - TC Guard: DISABLE
    - BPDU Protect: ENABLE 🔥🔥🔥 (สำคัญสุด — ป้องกัน rogue switch)
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: DISABLE
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```

📌 **ถ้ามีคนเสียบ switch:** → Port จะ shutdown ทันที
**Bandwidth Control:** PC/Printer อาจมี Misconfiguration → Storm Control ป้องกัน DHCP Storm, ARP Storm จากอุปกรณ์ End-user
---

### Profile 7 — 007-DEFAULT-MGMT 🔷

**Purpose:** Default configuration for management ports

**Applied To:**
- Management ports
- Ports requiring no special configuration

**Configuration:**

```bash
General:
- 802.1X Control: Auto
- Port Isolation: DISABLE
- Flow Control: ENABLE
- EEE: DISABLE
- Multicast Fast Leave: IGMP (IPv4)->DISABLE, MLD (IPv6)->DISABLE
- Loopback Control: Spanning Tree
  - Edge Port: ENABLE (พอร์ตขอบเครือข่าย)
  - Spanning Tree Config:
    - Loop Protect: DISABLE
    - Root Protect: DISABLE
    - TC Guard: DISABLE
    - BPDU Protect: ENABLE (ป้องกัน rogue switch)
    - BPDU Filter: DISABLE
    - BPDU Forward: DISABLE
LLDP-MED: DISABLE
Bandwidth Control: Storming Control
  - Rate Mode: Ratio
    - Broadcast: 1%
    - Unknown Unicast: 2%
    - Multicast: 2%
    - Action: Drop
```
**Bandwidth Control:** Management Port ใช้ทั่วไป → Storm Control เป็นค่า Default ปลอดภัย รอง
---

## Quick Reference — Port Profiles Summary

> **สรุปค่าตั้งค่าหลักของแต่ละ Profile สำหรับการเปรียบเทียบ**

| Profile | Edge Port | BPDU Protect | Root Protect | Loop Protect | LLDP-MED | Bandwidth Control |
|---------|-----------|--------------|--------------|--------------|----------|-------------------|
| **001-CORE-TRUNK-LACP** | DISABLE | DISABLE | DISABLE | ENABLE | DISABLE | Storming Control |
| **002-NAS-LACP** | DISABLE | DISABLE | DISABLE | ENABLE | DISABLE | Storming Control |
| **003-UNMANAGED-SWITCH** | DISABLE | DISABLE | **ENABLE** 🔥 | ENABLE | DISABLE | Storming Control |
| **004-AP-TRUNK** | **ENABLE** | **ENABLE** 🔥 | DISABLE | DISABLE | **ENABLE** | Storming Control |
| **005-VOICE-ONLY** | **ENABLE** | **ENABLE** 🔥 | DISABLE | DISABLE | **ENABLE** 🔥 | Storming Control |
| **006-ACCESS-PC** | **ENABLE** 🔥 | **ENABLE** 🔥🔥🔥 | DISABLE | DISABLE | DISABLE | Storming Control |
| **007-DEFAULT-MGMT** | **ENABLE** | **ENABLE** | DISABLE | DISABLE | DISABLE | Storming Control |

### ความหมายสัญลักษณ์

| สัญลักษณ์ | ความหมาย |
|-----------|----------|
| 🔥 | สำคัญ — ต้องเปิดเพื่อความปลอดภัย |
| 🔥🔥🔥 | สำคัญมาก — ห้ามปิดเด็ดขาด |

### หลักการเลือก Profile

| ประเภทพอร์ต | Profile | เหตุผลหลัก |
|-------------|---------|-----------|
| **Trunk LACP** | 001 | Loop Protect ป้องกัน Loop จากอุปกรณ์เบื้องหลัง |
| **NAS LACP** | 002 | NAS บางรุ่นส่ง BPDU แปลก → ห้ามเปิด BPDU Guard |
| **Unmanaged Switch** | 003 | **Root Protect** ป้องกัน switch เถื่อนยึด root bridge |
| **Access Point** | 004 | **Edge Port + BPDU Guard** ป้องกัน rogue switch |
| **IP Phone** | 005 | **LLDP-MED** สำหรับ Voice VLAN, BPDU Guard ปลอดภัย |
| **PC/Printer** | 006 | **Edge Port + BPDU Guard** ป้องกันการเสียบ switch โดยไม่ได้รับอนุญาต |
| **Management** | 007 | ค่า Default ปลอดภัย สำหรับพอร์ตทั่วไป |

---

## VLAN Mapping 🔶

### SG3210X-M2 (Core) Port Configuration

| Port | Destination | Profile | Native (Untagged) | Tagged | Voice |
|------|-------------|---------|-------------------|--------|-------|
| 1-2 | SG2428P (LACP) | 001-CORE-TRUNK-LACP | 20 | 10,30,40,50,70 | Off |
| 3-4 | QNAP (LACP) | 002-NAS-LACP | 10 | 20 🔥 | Off |
| 5-6 | ASUSTOR (LACP) | 002-NAS-LACP | 10 | 20 🔥 | Off |
| 7 | Reserved / MGMT Port | 007-DEFAULT-MGMT | 20 | None | Off |
| 8 | Admin Desktop | 006-ACCESS-PC | 10 | None | Off |
| 9 | ER7206 (Router) | 001-CORE-TRUNK-LACP | 20 | 10,30,40,50,70 | Off |
| 10 | Reserved / MGMT Port | 007-DEFAULT-MGMT | 20 | None | Off |

📌 **NAS (Port 3-6) ปรับใหม่:** เพิ่ม Tagged VLAN 20 สำหรับ MGMT redundancy

📌 **Trunk LACP (Port 1-2, 9):** Native VLAN 20 — ใช้ร่วมกับ Management VLAN เพื่อลดความซับซ้อน

---

### SG2428P (Access) Port Configuration

| Port | Destination | Profile | Native (Untagged) | Tagged | Voice |
|------|-------------|---------|-------------------|--------|-------|
| 1-16 | EAP610 | 004-AP-TRUNK | 20 | 10,30,40,50,70 🔥 allow all | Off |
| 17-18 | IP Phone Port 1 | 005-VOICE-ONLY | 50 | 30 | Enable (VLAN 50) |
| 19-20 | Reserved / MGMT Port | 007-DEFAULT-MGMT | 20 | None | Off |
| 21-22 | SG3210X-M2 (LACP) | 001-CORE-TRUNK-LACP | 20 | 10,30,40,50,70 | Off |
| 23 | Printer | 006-ACCESS-PC | 30 | None | Off |
| 24 | OC200 (Controller) | 007-DEFAULT-MGMT | 20 | None | Off |
| 25 | TL-SL1226P (CCTV) | 003-UNMANAGED-SWITCH | 40 | None | Off |
| 26 | TL-SG1210P (IP Phone + PC) | 003-UNMANAGED-SWITCH | 30 | 50 | Enable (VLAN 50) |
| 27-28 | Reserved / MGMT Port | 007-DEFAULT-MGMT | 20 | None | Off |

📌 **IP Phone Ports (17-18) ปรับใหม่:** Native VLAN 50 (Voice) + Tagged VLAN 30 (Data for PC ที่ต่อ Port 2 ของ IP Phone)

📌 **AP Ports (1-16) ปรับใหม่:** Allow all VLANs สำหรับ future expansion — Native VLAN 20 ร่วมกับ Management

📌 **SG2428P MGMT (Port 19-20, 27-28):** Access Switch ต้องการ Management IP บน VLAN 20

📌 **OC200 (Port 24):** Controller ใช้ VLAN 20 (MGMT) และ Hardening ด้วย **Network Tags Setting = Block All** ใน OC200 UI

---

## Network Diagram

```
                           ┌──────────────┐
                           │   ER7206     │
                           │ (Trunk 20)   │
                           └──────┬───────┘
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │     SG3210X-M2 (Core)    │
                     │    [Root Bridge 4096]    │
                     └──────────────────────────┘
        LACP 1-2  /   |      |       |       |   \  Reserved
                   /   |      |       |       |    \
                  ▼    ▼      ▼       ▼       ▼     ▼
         SG2428P (Access)   QNAP   ASUSTOR   Admin   Reserved
         [Priority 8192]   (VLAN10+20) (VLAN10+20) (VLAN10)
         (AP 1–16 Trunk)

Uplink SG3210X‑M2 (1–2) ↔ SG2428P (21–22)

WiFi Staff → VLAN 30
WiFi Guest → VLAN 70
CCTV → VLAN 40
IP Phone → VLAN 50
Printer → VLAN 30
Admin Desktop → VLAN 10
NAS → VLAN 10 (+20 MGMT)
OC200 → VLAN 20
```

---

## Configuration Procedure

### Step 1 — Create Port Profiles

1. Navigate to Omada SDN Controller → Port Profiles
2. Create each profile listed in the Port Profiles section
3. Configure all settings as specified
4. **Do not configure VLANs in Port Profiles** (VLANs are configured in Edit Port)

### Step 2 — Configure Port VLANs

1. Navigate to Omada SDN Controller → Switches → Edit Port
2. For each port, configure:
   - **Native Network (Untagged)** — The access VLAN for untagged traffic
   - **Tagged Network** — VLANs allowed on the trunk (comma-separated)
   - **Voice Network** — Voice VLAN (if applicable)
   - **Profile** — Select the appropriate Port Profile from Step 1
3. Apply configuration per the VLAN Mapping tables

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2026-04-24 | **FINAL VERSION** — STP-only (no Loop Detection), BPDU Guard on access ports, Root Guard on unmanaged switch ports, Native VLAN 20 สำหรับทุก Trunk, NAS with MGMT redundancy (VLAN 20 tagged), AP allow-all VLANs, Security Hardening section |
| 2.0 | 2026-04-24 | Updated port mappings (LACP 21-22), new VLAN scheme (30/40/50/70), consolidated CCTV/IoT to VLAN 40, added DHCP table, renamed PC-ONLY to ACCESS-PC |
| 1.0 | 2026-04-23 | Initial version with basic port profiles and VLAN mapping |

---

## Quick Reference — Edit Port Values

> **โครงสร้าง Omada UI (Edit Port):**
> 1. **Native Network** — PVID/Native VLAN
> 2. **Network Tags Setting** — Allow All / Block All / Custom (ควบคุม Tagged VLANs)
> 3. **Untagged Network** — VLAN สำหรับ Untagged traffic (แยกจาก Native)
> 4. **Tagged Network** — ปรากฏเมื่อเลือก Custom

### SG3210X-M2

| Port | Native | Network Tags | Untagged | Tagged | Profile | Voice |
|------|--------|--------------|----------|--------|---------|-------|
| 1-2 | 20 | Allow All | 20 | All (ยกเว้น 20) | 001-CORE-TRUNK-LACP | Off |
| 3-4 | 10 | Custom | 10 | 20 | 002-NAS-LACP | Off |
| 5-6 | 10 | Custom | 10 | 20 | 002-NAS-LACP | Off |
| 7 | 20 | Block All | 20 | — | 007-DEFAULT-MGMT | Off |
| 8 | 10 | Block All | 10 | — | 006-ACCESS-PC | Off |
| 9 | 20 | Allow All | 20 | All (ยกเว้น 20) | 001-CORE-TRUNK-LACP | Off |
| 10 | 20 | Block All | 20 | — | 007-DEFAULT-MGMT | Off |

### SG2428P

| Port | Native | Network Tags | Untagged | Tagged | Profile | Voice |
|------|--------|--------------|----------|--------|---------|-------|
| 1-16 | 20 | Allow All | 20 | All (ยกเว้น 20) | 004-AP-TRUNK | Off |
| 17-18 | 50 | Custom | 50 | 30 | 005-VOICE-ONLY | 50 |
| 19-20 | 20 | Block All | 20 | — | 007-DEFAULT-MGMT | Off |
| 21-22 | 20 | Allow All | 20 | All (ยกเว้น 20) | 001-CORE-TRUNK-LACP | Off |
| 23 | 30 | Block All | 30 | — | 006-ACCESS-PC | Off |
| 24 | 20 | Block All | 20 | — | 007-DEFAULT-MGMT | Off |
| 25 | 40 | Block All | 40 | — | 003-UNMANAGED-SWITCH | Off |
| 26 | 30 | Custom | 30 | 50 | 003-UNMANAGED-SWITCH | 50 |
| 27-28 | 20 | Block All | 20 | — | 007-DEFAULT-MGMT | Off |

### ความหมาย Network Tags Setting

| Network Tags | Tagged Networks | ใช้เมื่อ |
|--------------|-----------------|----------|
| **Allow All** | อนุญาตทุก VLAN (ยกเว้น Native) | Trunk, AP |
| **Block All** | ไม่อนุญาต VLAN ใดๆ | Access, MGMT |
| **Custom** | อนุญาตเฉพาะ VLAN ที่ระบุใน Tagged Network | NAS, Voice |

---

## Pre-Deployment Checklist

ก่อน Apply ค่า Configuration:
- [ ] สร้าง VLANs 10, 20, 30, 40, 50, 70 ใน Omada Controller (VLAN 20 = Native + Management)
- [ ] สร้าง Port Profiles 001–007 ครบถ้วน (STP Mode — ไม่ใช้ Loop Detection)
- [ ] ตรวจสอบ LACP Group Configuration (Port 1-2 ↔ Port 21-22)
- [ ] ตั้งค่า DHCP Server ตามตาราง VLAN Definitions
- [ ] ตรวจสอบว่า OC200 อยู่บน VLAN 20 และมี IP 192.168.20.x
- [ ] **OC200 Hardening:** Settings → Network → Network Tags Setting = **Block All** (เฉพาะ VLAN 20)
- [ ] **SG3210X-M2 MGMT:** ตั้งค่า Management IP บน VLAN 20 (192.168.20.x) — Port 7, 10 ใช้ VLAN 20
- [ ] **ER7206 MGMT:** Router มี IP บน VLAN 20 (ผ่าน Tagged) — Native VLAN 20 ใช้ร่วมกับ Management
- [ ] **SG2428P MGMT:** Access Switch ได้รับ IP บน VLAN 20 ผ่าน Uplink — ตรวจสอบใน Devices
- [ ] **AP MGMT:** EAP610 ได้รับ Management IP ผ่าน VLAN 20 — ตรวจสอบการ Adopt
- [ ] ตรวจสอบ Voice VLAN Enable บน Port 17-18 และ 26
- [ ] กำหนด STP Priority: Core=4096, Access=8192
- [ ] สำรอง Configuration ปัจจุบันก่อน Apply

---

# Testing Guide — VLAN + LACP + STP

การทดสอบทีละ Layer โดยไม่ต้องใช้เครื่องมือพิเศษ — ใช้แค่ PC + ping + OC200 UI

---

## PART 1 — Testing VLAN (Step-by-Step)

### Goal
- ตรวจสอบว่าแต่ละพอร์ตอยู่ VLAN ถูกต้อง
- ตรวจสอบว่า Tagged/Untagged ทำงาน
- ตรวจสอบว่า DHCP แจก IP ถูก subnet
- ตรวจสอบว่า WiFi → VLAN ถูกต้อง

---

### STEP 1 — Test VLAN 10 (NAS-ADMIN)

**Test Equipment:**
- Admin Desktop (Port 8 SG3210X-M2)
- QNAP / ASUSTOR

**Procedure:**
1. Connect Admin Desktop → Port 8
2. Open Command Prompt
3. Type:
   ```
   ipconfig
   ```
4. Expected IP range:
   ```
   192.168.10.x
   ```

**Ping Tests:**
```
ping 192.168.10.1   ← Gateway
ping <QNAP-IP>
ping <ASUSTOR-IP>
```

**Expected Result:**
- All pings successful
- Should NOT ping to VLAN 30/40/50/70 (if ACL configured)

---

### STEP 2 — Test VLAN 30 (USERS)

**Test Equipment:**
- General PC
- Printer
- Staff WiFi (SSID: Staff)

**Procedure:**
1. Connect PC → Port 23 or Port 26 (via TL-SG1210P)
2. Type:
   ```
   ipconfig
   ```
3. Expected IP:
   ```
   192.168.30.x
   ```

**Ping Tests:**
```
ping 192.168.30.1
ping <Printer-IP>
```

**WiFi Staff Test:**
1. Connect to SSID Staff
2. Type:
   ```
   ipconfig
   ```
3. Expected IP: 192.168.30.x

---

### STEP 3 — Test VLAN 40 (CCTV/IoT)

**Test Equipment:**
- CCTV Camera (via TL-SL1226P Port 25)

**Procedure:**
1. Open OC200 → Clients
2. Camera must show as VLAN 40
3. Test ping from Admin Desktop:
   ```
   ping <CCTV-IP>
   ```

**Expected Result:**
- Ping successful
- DHCP must assign IP 192.168.40.x

---

### STEP 4 — Test VLAN 50 (VOICE)

**Test Equipment:**
- IP Phone (Port 17–18 SG2428P)

**Procedure:**
1. IP Phone boots up
2. Expected IP:
   ```
   192.168.50.x
   ```
3. In OC200 → Clients, must see Voice VLAN 50

**LLDP-MED Test:**
In OC200 → Switch → Port 17–18, must see:
```
LLDP-MED: Active
Voice VLAN: 50
```

---

### STEP 5 — Test VLAN 70 (Guest WiFi)

**Procedure:**
1. Connect to SSID Guest
2. Type:
   ```
   ipconfig
   ```
3. Expected IP:
   ```
   192.168.70.x
   ```

**Isolation Test:**
```
ping 192.168.30.1   ← Must NOT pass
ping 192.168.10.1   ← Must NOT pass
```

---

## PART 2 — Testing LACP (Step-by-Step)

### Goal
- ตรวจสอบว่า LACP ระหว่าง SG3210X-M2 ↔ SG2428P ทำงาน
- ตรวจสอบว่า QNAP/ASUSTOR LACP ทำงาน
- ตรวจสอบว่าไม่มี Mis-config

---

### STEP 1 — Check LACP Status in OC200

**Path:** Insight → Switch → LAG Status

Expected status:

**SG3210X-M2:**
- LAG1 (Port 1–2) → **Up**
- LAG2 (Port 3–4) → **Up**
- LAG3 (Port 5–6) → **Up**

**SG2428P:**
- LAG1 (Port 21–22) → **Up**

---

### STEP 2 — Test Load Balancing

**Procedure:**
1. Open QNAP → File Station
2. Copy large file (10–20GB) to Admin Desktop
3. Open Task Manager → Performance → Ethernet
4. Must see traffic on both links (Port 3–4 or 5–6)

**Uplink Test:**
1. Run Speedtest between PC VLAN 30 → NAS VLAN 10
2. Must achieve > 1Gbps (if 2Gbps LACP)

---

### STEP 3 — Test Failover

**Procedure:**
1. Disconnect cable from **Port 1** of SG3210X-M2
2. LACP must remain **Up** (using Port 2)
3. Disconnect Port 2 → LACP must go Down

Repeat test with QNAP/ASUSTOR

---

## PART 3 — Testing STP (Step-by-Step)

### Goal
- ตรวจสอบว่าไม่มี Loop
- ตรวจสอบว่า Root Bridge ถูกต้อง
- ตรวจสอบว่า STP Security ทำงาน

---

### STEP 1 — Check Root Bridge

**Path:** Devices → SG3210X-M2 → Ports → STP

Expected:
```
SG3210X-M2 = Root Bridge
```

If not, adjust Priority:
```
SG3210X-M2 Priority = 4096
SG2428P Priority = 8192
```

---

### STEP 2 — Test Loop Detection

**Safe Test Method:**
1. Go to TL-SG1210P (Port 26 SG2428P)
2. Create loop with LAN cable (Port 1 ↔ Port 2)
3. Check OC200 → Alerts

Expected alert:
```
Loop Detected on Port 26
Port Shutdown (BPDU Protect)
```

Port must auto-shutdown

---

### STEP 3 — Test STP Blocking

**Procedure:**
1. Connect cable from SG2428P Port 19 → SG2428P Port 20
2. Check OC200 → Switch → Ports

Expected:
```
STP State: Blocking
```

---

### STEP 4 — Test Topology Change (TC Guard)

**Procedure:**
1. Power cycle AP (Port 1–16)
2. Check OC200 → Logs

Expected: **NO** message:
```
Topology Change Detected
```

Because TC Guard is enabled

---

## PART 4 — Testing Checklist (SOP)

### VLAN Tests
- [ ] VLAN 10 gets IP 192.168.10.x
- [ ] VLAN 30 gets IP 192.168.30.x
- [ ] VLAN 40 gets IP 192.168.40.x
- [ ] VLAN 50 gets IP 192.168.50.x
- [ ] VLAN 70 gets IP 192.168.70.x

### WiFi Tests
- [ ] Staff WiFi → VLAN 30
- [ ] Guest WiFi → VLAN 70

### Device Tests
- [ ] CCTV → VLAN 40
- [ ] IP Phone → VLAN 50
- [ ] Printer → VLAN 30
- [ ] Admin Desktop → VLAN 10
- [ ] NAS → VLAN 10
- [ ] OC200 → VLAN 20

### LACP Tests
- [ ] LACP SG3210X-M2 ↔ SG2428P = Up
- [ ] LACP QNAP = Up
- [ ] LACP ASUSTOR = Up
- [ ] Load balancing works (2Gbps)
- [ ] Failover works (single link failure)

### STP Tests
- [ ] Root Bridge = SG3210X-M2 (Priority 4096)
- [ ] BPDU Guard shutdown test (เสียบ switch ที่ port PC → port ต้อง shutdown)
- [ ] Root Guard works (003-UNMANAGED-SWITCH)
- [ ] STP Blocking works
- [ ] TC Guard works (no topology change on AP reboot)

---

# 🔐 Security Hardening (ต้องทำเพิ่ม)

Required security configurations for Enterprise-grade network protection.

---

## DHCP Snooping 🔥

```bash
Global: ENABLE

Trusted Ports:
- Uplink ไป Router (ER7206)
- Core Trunk (Port 1-2, 9)
```

**Path:** Settings → Wired Networks → Switch → DHCP Snooping

1. Enable **DHCP Snooping** globally
2. Mark **Trusted Ports**:
   - SG3210X-M2 Port 9 (to ER7206)
   - SG3210X-M2 Port 1-2 (Core Trunk)
   - SG2428P Port 21-22 (Uplink to Core)
3. **Untrusted:** ทุก access port (จะถูก block ถ้าส่ง DHCP Offer)

---

## Storm Control (AP Ports) 🔥

```bash
Broadcast: 1%
Multicast: 2%
Unknown: 2%
```

**Path:** Settings → Wired Networks → Switch → Port Profile → 004-AP-TRUNK

1. Navigate to **Bandwidth Control / Storm Control**
2. Configure:
   - Broadcast: 1% (หรือ 1000 pps)
   - Multicast: 2% (หรือ 2000 pps)
   - Unknown Unicast: 2% (หรือ 2000 pps)
3. Save

📌 **หมายเหตุ:** ใช้ percentage หรือ pps ตามความเหมาะสมกับ traffic

---

## STP Priority (Root Bridge Election) 🔥

```bash
SG3210X-M2 (Core): 4096
SG2428P (Access): 8192
```

**Path:** Devices → Switch → Config → STP → Priority

1. **SG3210X-M2:** Set Priority = **4096** (Root Bridge)
2. **SG2428P:** Set Priority = **8192** (Backup Root)
3. Save and verify:
   ```
   OC200 → Topology → Root Bridge = SG3210X-M2
   ```

📌 **สำคัญ:** Core ต้องเป็น Root Bridge เสมอ

---

## Jumbo Frame 🔥

```bash
MTU: 9000
(ต้องตั้งทุก device ให้เท่ากัน)
```

### SG3210X-M2
**Path:** Devices → SG3210X-M2 → Config → Switch Settings
```
Jumbo Frame: Enable
MTU: 9000
```

### QNAP
**Path:** Control Panel → Network & Virtual Switch → Interfaces
```
MTU: 9000
```

### ASUSTOR
**Path:** Settings → Network → Interface → Advanced
```
Jumbo Frame: 9000
```

⚠️ **คำเตือน:** ถ้าตั้งไม่เท่ากันทุก device → จะมีปัญหา fragmentation หรือ packet drop

---

## 💥 Final Validation Checklist

### Connectivity Tests
- [ ] LACP = UP ทุกเส้น (Core↔Access, NAS)
- [ ] Root Bridge = Core Switch (SG3210X-M2 Priority 4096)
- [ ] เสียบ switch ที่ port PC → port ต้อง shutdown (BPDU Guard)
- [ ] WiFi ได้ VLAN ถูกต้อง (Staff=30, Guest=70)
- [ ] NAS เข้าถึงได้ทั้ง VLAN 10 และ 20
- [ ] Guest VLAN เข้า LAN ไม่ได้ (isolation)

### Security Tests
- [ ] DHCP Snooping blocks rogue DHCP
- [ ] Storm Control limits broadcast
- [ ] BPDU Guard shuts down unauthorized switches
- [ ] Root Guard prevents rogue root bridge

### Performance Tests
- [ ] Jumbo Frame works (MTU 9000 end-to-end)
- [ ] LACP load balancing (2Gbps aggregate)
- [ ] Failover works (single link failure)

---

## Configuration Analysis & Recommendations 🔍

> **สรุปการวิเคราะห์การตั้งค่าปัจจุบัน พร้อมข้อเสนอแนะสำหรับการปรับปรุง**

---

### 1. VLAN Architecture Analysis

| หัวข้อ | สถานะปัจจุบัน | การประเมิน | ข้อเสนอแนะ |
|--------|--------------|-----------|-----------|
| **Native VLAN** | VLAN 20 (MGMT) | ✅ ดี — ใช้ VLAN เดียวกับ Management | คงไว้ ลดความซับซ้อน |
| **VLAN 999** | UNUSED | ⚠️ ระวัง — ไม่ใช้แล้วแต่ยังมีในระบบ | พิจารณาลบออกหรือเก็บสำรอง |
| **VLAN Segmentation** | 7 VLANs (10,20,30,40,50,60,70) | ✅ ดี — แยกกลุ่มชัดเจน | คงไว้ ครอบคลุมทุก use case |
| **Guest VLAN (70)** | แยกจาก USERS (30) | ✅ ดี — Security สูง | คงไว้ มี Isolation ที่ถูกต้อง |

#### ⚠️ ประเด็นที่ต้องระวัง

```
🔴 VLAN 20 ใช้ทั้ง Native + Management
   └─ ข้อดี: ลดความซับซ้อน
   └─ ข้อควรระวัง: ต้องใช้ Network Tags = Block All บน MGMT ports
      เพื่อป้องกัน unauthorized access
```

---

### 2. Port Profile Analysis

| Profile | จุดแข็ง | จุดที่ต้องระวัง | คะแนน |
|---------|---------|----------------|--------|
| **001-CORE-TRUNK-LACP** | Loop Protect เปิด — ป้องกัน loop จาก downstream | ไม่มี Root Protect (ถูกต้องสำหรับ Trunk) | ⭐⭐⭐⭐⭐ |
| **002-NAS-LACP** | BPDU Protect ปิด — รองรับ NAS ที่ส่ง BPDU แปลก | ต้องตรวจสอบ NAS รุ่นก่อนใช้ | ⭐⭐⭐⭐ |
| **003-UNMANAGED-SWITCH** | Root Protect + Loop Protect — ปลอดภัยสูงสุด | ต้องใช้กับ Unmanaged Switch เท่านั้น | ⭐⭐⭐⭐⭐ |
| **004-AP-TRUNK** | Edge Port + BPDU Guard — ป้องกัน rogue AP | LLDP-MED เปิด — ตรวจสอบ AP รองรับ | ⭐⭐⭐⭐⭐ |
| **005-VOICE-ONLY** | BPDU Guard + LLDP-MED — เหมาะสมกับ IP Phone | ต้องตรวจสอบ Phone รองรับ LLDP-MED | ⭐⭐⭐⭐⭐ |
| **006-ACCESS-PC** | Edge Port + BPDU Guard 🔥🔥🔥 — ปลอดภัยสูง | ถ้ามี switch ซ่อน จะ shutdown ทันที | ⭐⭐⭐⭐⭐ |
| **007-DEFAULT-MGMT** | สมดุลระหว่างปลอดภัยและใช้งานได้ | ไม่มี LLDP-MED (ไม่จำเป็น) | ⭐⭐⭐⭐ |

#### 🎯 ข้อเสนอแนะเพิ่มเติมสำหรับ Profile

```
💡 003-UNMANAGED-SWITCH:
   └─ พิจารณาเพิ่ม TC Guard = ENABLE ถ้า downstream switch
      มี Topology Change บ่อย (เช่น CCTV ที่ reboot บ่อย)

💡 004-AP-TRUNK:
   └─ ถ้า AP ไม่รองรับ LLDP-MED ให้ปิด LLDP-MED เพื่อประหยัดทรัพยากร
   └─ หรือใช้ VLAN กำหนดเองใน AP GUI แทน
```

---

### 3. Network Tags (VLAN Assignment) Analysis

| พอร์ต | Network Tags | ความเหมาะสม | หมายเหตุ |
|--------|-------------|-------------|----------|
| **Trunk (1-2, 9, 21-22)** | Allow All | ✅ ถูกต้อง | ต้องรองรับทุก VLAN |
| **AP (1-16)** | Allow All | ✅ ถูกต้อง | WiFi มีหลาย SSID/หลาย VLAN |
| **NAS (3-6)** | Custom (20) | ✅ ถูกต้อง | NAS ต้องการ VLAN 10+20 เท่านั้น |
| **MGMT (7, 10, 19-20, 24, 27-28)** | Block All | ✅ ถูกต้อง | ปลอดภัย — ไม่ต้อง Tagged VLAN |
| **PC/Printer (8, 23)** | Block All | ✅ ถูกต้อง | Access port ไม่ต้อง Tagged |
| **Voice (17-18, 26)** | Custom (30/50) | ✅ ถูกต้อง | Voice VLAN + Data VLAN |

#### ⚠️ ประเด็นที่ตรวจสอบ

```
🔴 Port 24 (OC200):
   └─ Network Tags = Block All ✅
   └─ ต้องตั้งค่า OC200 UI: Settings → Network → Network Tags = Block All
      เพื่อให้สอดคล้องกับ Switch config

🔴 Port 26 (TL-SG1210P):
   └─ Untagged = 30, Tagged = 50 (Custom)
   └─ ตรวจสอบว่า TL-SG1210P ส่งต่อ Voice VLAN ได้จริง
      (บางรุ่น unmanaged switch ไม่ส่งต่อ VLAN tag)
```

---

### 4. Security Analysis

| หัวข้อ | การตั้งค่า | ความปลอดภัย | ข้อเสนอแนะ |
|--------|-----------|------------|-----------|
| **BPDU Guard** | เปิดบน Access/Voice/MGMT | 🔒 สูง | คงไว้ ป้องกัน rogue switch |
| **Root Guard** | เปิดบน Unmanaged Switch | 🔒 สูง | คงไว้ ป้องกัน root hijack |
| **Loop Protect** | เปิดบน Trunk/NAS | 🔒 ปานกลาง-สูง | คงไว้ |
| **Storm Control** | ทุก Profile ใช้ 1%/2%/2% | 🔒 ปานกลาง | คงไว้ ป้องกัน broadcast storm |
| **Port Isolation** | ทุก Profile = DISABLE | ⚠️ ระวัง | ปิดถูกต้อง — ต้องใช้ VLAN แยกแทน |
| **802.1X** | Auto (ทุก Profile) | ⚠️ ยังไม่ใช้ | พร้อมสำหรับ future NAC |

#### 🚨 ข้อเสนอแนะด้าน Security

```
🟢 Immediate (ทำทันที):
   1. เปิด DHCP Snooping บนทุก Access Port (ยกเว้น Trunk)
   2. เปิด Dynamic ARP Inspection (DAI) บน VLAN 30 (USERS)
   3. ตั้งค่า Login Banner บน Switch ทั้งสองตัว

🟡 Short-term (ทำใน 1-2 สัปดาห์):
   4. ตั้งค่า SNMP Community String ที่ซับซ้อน (ไม่ใช้ public/private)
   5. เปิด SSH Access แทน Telnet (ถ้ายังไม่ได้เปิด)
   6. ตั้งค่า Syslog Server (ส่ง logs ไป NAS หรือ QNAP)

🔵 Long-term (ทำใน 1-3 เดือน):
   7. พิจารณาใช้ 802.1X (NAC) สำหรับ PC/Printer
   8. ตั้งค่า MACsec (ถม่อุปกรณ์รองรับ) สำหรับ Trunk links
   9. ทำ Network Segmentation ระดับ L3 (Inter-VLAN routing ผ่าน Firewall)
```

---

### 5. Performance Analysis

| หัวข้อ | สถานะ | การประเมิน | ข้อเสนอแนะ |
|--------|-------|-----------|-----------|
| **LACP (2Gbps)** | ใช้ที่ Port 1-2 และ 21-22 | ✅ ดี | ครอบคลุม bandwidth ปัจจุบัน |
| **Storm Control 1%/2%/2%** | ทุก Profile | ✅ เหมาะสม | ไม่กระทบปกติ แต่ป้องกัน storm |
| **Flow Control** | ENABLE ทุก Profile | ⚠️ ดีแต่ไม่จำเป็น | คงไว้ แต่ไม่ใช่ critical |
| **EEE (Energy Efficient)** | DISABLE ทุก Profile | ✅ ถูกต้อง | ปิดถูกต้อง — อาจทำให้ latency สูง |
| **Multicast Fast Leave** | DISABLE ทุก Profile | ⚠️ ไม่จำเป็น | คงไว้ หรือเปิดถ้ามี IPTV |

#### 📊 Bandwidth Planning

```
ปัจจุบัน:
├── Trunk: 2Gbps (LACP x2) → เพียงพอสำหรับ 16 AP + NAS + CCTV
├── AP (16 ตัว): ~100Mbps/ตัว (peak) → 1.6Gbps รวม ✅
├── NAS: 1Gbps (LACP 2Gbps) ✅
└── IP Phone: ~100kbps/ตัว → ไม่มีผล ✅

อนาคต (ถ้า upgrade):
├── ถ้าเปลี่ยน AP เป็น WiFi 6/6E → bandwidth/ตัว ~300-500Mbps
├── อาจต้อง upgrade Core Switch เป็น 10G
└── พิจารณาเพิ่ม LACP group (3-4 links) แทน 2 links
```

---

### 6. STP (Spanning Tree) Analysis

| หัวข้อ | สถานะ | ความเหมาะสม |
|--------|-------|-------------|
| **STP Mode** | RSTP/MSTP (กำหนดใน Global) | ✅ ถูกต้อง — ไม่ใช้ Loop Detection |
| **Core Priority** | 4096 | ✅ ถูกต้อง — ต่ำสุด = Root Bridge |
| **Access Priority** | 8192 | ✅ ถูกต้อง — สูงกว่า Core |
| **Edge Port** | เปิดบน Access/Voice/MGMT | ✅ ถูกต้อง — เร่ง convergence |
| **BPDU Guard** | เปิดบน Edge Ports | ✅ ถูกต้อง — ป้องกัน rogue switch |

#### ⚠️ ประเด็น STP ที่ต้องระวัง

```
🔴 STP Topology Change:
   └─ ถ้ามี Topology Change บ่อย (เช่น CCTV reboot, AP reconnect)
      อาจทำให้ network unstable
   └─ แก้ไข: เปิด TC Guard บนพอร์ตที่มีปัญหา (003-UNMANAGED-SWITCH)

🔴 BPDU Filter vs BPDU Guard:
   └─ ปัจจุบันใช้ BPDU Guard บน Edge Ports ✅
   └─ ไม่ควรใช้ BPDU Filter (อันตราย — อาจทำให้ loop ไม่ถูก detect)
```

---

### 7. สรุปข้อเสนอแนะ (Summary of Recommendations)

#### 🟢 ทำทันที (Immediate Actions)

| ลำดับ | การกระทำ | ความสำคัญ | ผลกระทบ |
|-------|----------|-----------|---------|
| 1 | ตรวจสอบ OC200 Network Tags = Block All | 🔴 สูง | ป้องกัน unauthorized VLAN access |
| 2 | เปิด DHCP Snooping บน VLAN 30 | 🔴 สูง | ป้องกัน rogue DHCP server |
| 3 | ตั้งค่า SNMP Community (ไม่ใช้ public) | 🟡 ปานกลาง | ป้องกัน SNMP enumeration |
| 4 | Backup config ทั้งสอง switch | 🔴 สูง | กู้คืนได้ถ้ามีปัญหา |

#### 🟡 ทำในอนาคต (Future Improvements)

| ลำดับ | การกระทำ | เหตุผล | ระยะเวลา |
|-------|----------|--------|----------|
| 5 | พิจารณา VLAN 999 → ลบออก | ลดความซับซ้อน | หลังทดสอบ stable |
| 6 | เปิด Dynamic ARP Inspection | ป้องกัน ARP spoofing | 1-2 สัปดาห์ |
| 7 | ตั้งค่า Syslog → NAS | เก็บ logs สำหรับ audit | 1 สัปดาห์ |
| 8 | ทำ LACP 3-4 links (ถ้ามี port เหลือ) | เพิ่ม redundancy | อนาคต |

#### 🔵 ติดตาม (Monitoring)

```
📊 Metrics ที่ควร monitor:
├── STP Topology Changes (ควร = 0 หรือน้อยมาก)
├── Broadcast/Multicast Rate (ควร < 1% ของ bandwidth)
├── Port Errors (CRC, collisions)
├── LACP Status (ควร = Up ทุก link)
└── CPU/Memory Usage ของ Switch

🔔 Alerts ที่ควรตั้ง:
├── BPDU Guard Triggered (มีคนเสียบ switch โดยไม่ได้รับอนุญาต)
├── Root Guard Triggered (มี switch พยายามเป็น root)
├── Storm Control Triggered (มี broadcast storm)
└── LACP Link Down (redundancy ลดลง)
```

---

### 8. Risk Assessment Matrix

| Risk | โอกาสเกิด | ผลกระทบ | ระดับ | มาตรการป้องกัน |
|------|----------|---------|-------|--------------|
| VLAN 20 ทั้ง Native + Management | สูง (ใช้ทั้งระบบ) | ปานกลาง | 🟡 Medium | Network Tags = Block All บน MGMT |
| Unmanaged Switch ไม่ส่งต่อ VLAN | ปานกลาง | สูง | 🟡 Medium | ตรวจสอบรุ่น TL-SG1210P/SL1226P |
| LACP 2 links ไม่พอในอนาคต | ต่ำ (ปัจจุบันพอ) | ปานกลาง | 🟢 Low | Monitor bandwidth ต่อเนื่อง |
| 802.1X ยังไม่เปิดใช้ | สูง (ยังไม่ได้ใช้) | ต่ำ | 🟢 Low | มี VLAN separation อยู่แล้ว |
| No DHCP Snooping | ต่ำ | สูง | 🟡 Medium | เปิดทันที |
| No DAI | ต่ำ | สูง | 🟡 Medium | เปิดในอนาคต |

---

### 9. Final Score

| Category | Score | Comment |
|----------|-------|---------|
| **VLAN Design** | 9/10 | ดีมาก — แยกกลุ่มชัดเจน |
| **Port Profiles** | 9/10 | ดีมาก — ครอบคลุมทุก use case |
| **STP Security** | 9/10 | ดีมาก — BPDU/Root Guard ครบ |
| **Layer 2 Security** | 7/10 | ดี — แต่ยังขาด DHCP Snooping/DAI |
| **Performance** | 8/10 | ดี — LACP ครอบคลุม |
| **Documentation** | 9/10 | ดีมาก — ละเอียดครบถ้วน |
| **Overall** | **8.5/10** | **ดีมาก — พร้อมใช้งาน production** |

---

## Related Documents

- Network Architecture Design — `specs/02-architecture/02-03-network-design.md`
- VLAN Scheme — See [VLAN Definitions](#vlan-definitions) section
- IP Addressing Scheme — See DHCP table in [VLAN Definitions](#vlan-definitions) section
- Security Guidelines — `specs/06-Decision-Records/ADR-016-security-authentication.md`
- Release Policy — `specs/04-Infrastructure-OPS/04-08-release-management-policy.md` (สำหรับ network changes)

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Type** | Infrastructure Specification |
| **Language** | Thai (explanations), English (technical terms) |
| **Standards** | AGENTS.md v1.8.9 |
| **Review Cycle** | Per release or on equipment change |
| **Approval Required** | Yes — Infrastructure Lead + Security Review |



