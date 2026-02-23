specs/
├── 00-Overview/                 # ภาพรวมระบบ
│   ├── 00-01-system-context.md  # บริบทของระบบ (On-Prem, Segmented Network)
│   ├── 00-02-glossary.md        # คำศัพท์และตัวย่อในระบบ DMS
│   └── 00-03-quick-start.md     # คู่มือเริ่มต้นสำหรับนักพัฒนา
│
├── 01-Requirements/      # Business Rules & Document Control (Core)
│   ├── modules/                 # สเปคของแต่ละระบบย่อย
│   │   ├── 01-rfa.md
│   │   ├── 02-drawings.md       # Contract & Shop Drawings
│   │   ├── 03-correspondence.md
│   │   └── 04-transmittals-circulation.md
│   └── business-rules/          # กฎเหล็กของ DMS (ห้ามละเมิด)
│       ├── doc-numbering-rules.md # กฎการรันเลขเอกสาร & Conflict Detection
│       ├── revision-control.md    # กฎการทำ Revision (Superseded, ข้อมูลอ้างอิง)
│       └── rbac-matrix.md         # สิทธิ์การเข้าถึงข้อมูลและการอนุมัติ
│
├── 02-Architecture/             # สถาปัตยกรรมระบบ (System & Network)
│   ├── 02-01-api-design.md
│   ├── 02-02-security-layer.md  # Application Security, App/Dev Separation
│   └── 02-03-network-design.md  # Network Segmentation (VLAN, VPN, QNAP/ASUSTOR)
│
├── 03-Data-and-Storage/         # โครงสร้างฐานข้อมูลและการจัดการไฟล์
│   ├── 03-01-data-dictionary.md
│   ├── 03-02-db-indexing.md     # Index recommendations, Soft-delete strategy
│   └── 03-03-file-storage.md    # Secure File Handling (Outside webroot, QNAP Mounts)
│
├── 04-Infrastructure-OPS/       # โครงสร้างพื้นฐานและการปฏิบัติการ (Merge 04 & 08 เดิม)
│   ├── 04-01-docker-compose.md  # DEV/PROD Docker configuration
│   ├── 04-02-nginx-proxy.md     # Nginx Reverse Proxy & SSL Setup
│   ├── 04-03-monitoring.md      # KPI, Audit Logging, Grafana/Prometheus
│   └── 04-04-backup-recovery.md # Disaster Recovery & DB Backup
│
├── 05-Engineering-Guidelines/   # มาตรฐานการพัฒนา
│   ├── 05-01-backend.md         # Node.js/PHP Guidelines, Error Handling
│   ├── 05-02-frontend.md        # UI/UX & Form Validation Strategy
│   └── 05-03-testing.md         # Unit/E2E Testing Strategy
│
├── 06-Decision-Records/                     # Architecture Decision Records (05-decisions เดิม)
│   ├── ADR-001-unified-workflow.md
│   └── ADR-002-doc-numbering.md
│
└── 99-archives/                 # ประวัติการทำงานและ Tasks (แยกออกมาจาก Specs หลัก)
    ├── history/                 # 09-history เดิม
    ├── tasks/                   # 06-tasks เดิม
    └── obsolete-specs/          # เอกสารสเปคเวอร์ชันเก่า (V1.4.2 ฯลฯ)
