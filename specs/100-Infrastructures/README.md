# 100-Infrastructures

โฟลเดอร์นี้ใช้เก็บงานที่เกี่ยวกับ **Infrastructure** ของระบบ NAP-DMS

## ขอบเขตงาน (Scope)

งานที่ควรอยู่ในโฟลเดอร์นี้ ได้แก่:

- **Infrastructure Operations** - การดำเนินงานพื้นฐาน (Deployment, Monitoring, Backup/Recovery)
- **Docker Compose** - การจัดการ Container stacks บน QNAP/ASUSTOR
- **Network Design** - การออกแบบ Network Segmentation, VLAN
- **Security Hardening** - การเสริมความปลอดภัยของ Infrastructure
- **CI/CD** - การตั้งค่า Gitea Actions, Deployment pipelines
- **Maintenance Procedures** - ขั้นตอนการดูแลรักษาระบบเบื้องต้น

## ตัวอย่างงานที่อยู่ในโฟลเดอร์นี้

- `102-infra-ops` - Infrastructure Operations & Deployment Automation

## การตั้งชื่อโฟลเดอร์

ใช้รูปแบบ: `1XX-feature-name`

- **1** = หลักร้อยของหมวดหมู่ (100-Infrastructures)
- **XX** = เลขลำดับงาน (01, 02, 03, ...)
- **feature-name** = ชื่องาน (kebab-case)

ตัวอย่าง:
- `101-network-segmentation`
- `102-infra-ops`
- `103-security-hardening`

## โครงสร้างไฟล์ในแต่ละงาน

แต่ละโฟลเดอร์งานควรมีไฟล์ต่อไปนี้ (ถ้าเกี่ยวข้อง):

```
1XX-feature-name/
├── spec.md          # คำอธิบายงานโดยละเอียด
├── plan.md          # แผนการดำเนินงาน
├── tasks.md         # รายการงานย่อย
├── quickstart.md    # คู่มือเริ่มต้น (ถ้ามี)
├── research.md      # การวิจัย/ศึกษา (ถ้ามี)
├── data-model.md    # โครงสร้างข้อมูล (ถ้ามี)
├── checklists/      # Checklist ตรวจสอบ (ถ้ามี)
└── contracts/       # สัญญา/ข้อตกลง (ถ้ามี)
```

## การเชื่อมโยงกับ Core Specs

งานในโฟลเดอร์นี้ควรอ้างอิง Core Specs ที่เกี่ยวข้อง:

- `04-Infrastructure-OPS/` - Infrastructure & Operations Guide
- `02-Architecture/` - System & Network Architecture
- `06-Decision-Records/` - ADRs ที่เกี่ยวข้อง (ADR-010, ADR-015, ADR-016)
