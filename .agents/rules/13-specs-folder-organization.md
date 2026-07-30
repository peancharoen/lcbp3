# Specs Folder Organization

โครงสร้างโฟลเดอร์ `specs/` แบ่งเป็น 2 ส่วนหลัก:

## 1. Core Specs (Permanent - ไม่เปลี่ยนชื่อ)

โฟลเดอร์เหล่านี้เป็น Source of Truth ถาวรของระบบ:

- `00-overview/` - ภาพรวมระบบ + Product Vision + KPI + Training
- `01-requirements/` - Business Requirements & Modularity
- `02-architecture/` - สถาปัตยกรรมระบบ (System & Network)
- `03-Data-and-Storage/` - โครงสร้างฐานข้อมูลและการจัดการไฟล์
- `04-Infrastructure-OPS/` - โครงสร้างพื้นฐานและการปฏิบัติการ
- `05-Engineering-Guidelines/` - มาตรฐานการพัฒนาและการเขียนโค้ด
- `06-Decision-Records/` - Architecture Decision Records (ADRs)
- `08-Tasks/` - Task documents
- `88-logs/` - Logs
- `99-archives/` - ประวัติการทำงานและ Tasks เก่า

## 2. Feature Work (Categorized - ใช้สำหรับงาน Implement)

โฟลเดอร์เหล่านี้ใช้เก็บ plan.md, spec.md, tasks.md สำหรับงานที่กำลังดำเนินการ:

- `100-Infrastructures/` - งานที่เกี่ยวกับ Infrastructure (Deployment, Monitoring, Docker Compose, Network)
- `200-fullstacks/` - งาน Fullstack Development (Backend + Frontend features, Workflow Engine, API)
- `300-others/` - งานอื่นๆ (Documentation, Research, Non-code tasks)

### การตั้งชื่อโฟลเดอร์ Feature Work

ใช้รูปแบบ: `nXX-feature-name`

- **n** = หลักร้อยของหมวดหมู่ (1, 2, 3)
- **XX** = เลขลำดับงาน (01, 02, 03, ...)
- **feature-name** = ชื่องาน (kebab-case)

ตัวอย่าง:

- `100-Infrastructures/102-infra-ops` - Infrastructure Operations
- `200-fullstacks/201-transmittals-circulation` - Transmittals + Circulation Integration
- `200-fullstacks/203-unified-workflow-engine` - Unified Workflow Engine

### กฎสำคัญ

- **เมื่อสร้าง feature spec ใหม่** → วางไว้ในหมวดหมู่ที่เหมาะสม (100/200/300)
- **ใช้เลขลำดับต่อจากงานล่าสุด** ในหมวดหมู่เดียวกัน
- **อ่าน README.md** ในแต่ละหมวดหมู่ก่อนเริ่มงาน

ดูรายละเอียดเพิ่มเติมใน:

- `specs/100-Infrastructures/README.md`
- `specs/200-fullstacks/README.md`
- `specs/300-others/README.md`
