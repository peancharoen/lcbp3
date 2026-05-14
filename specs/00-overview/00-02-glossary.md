# Glossary - คำศัพท์และคำย่อทางเทคนิค

**Project:** LCBP3-DMS
**Version:** 1.9.0
**Last Updated:** 2026-05-13

---

## 📋 General Terms (คำศัพท์ทั่วไป)

### A

**ADR (Architecture Decision Record)**
เอกสารบันทึกการตัดสินใจทางสถาปัตยกรรมที่สำคัญ พร้อมบริบท ทางเลือก และเหตุผล (ดู ADR-001 ถึง ADR-021)

**API (Application Programming Interface)**
ชุดคำสั่งและโปรโตคอลที่ใช้สำหรับการสื่อสารระหว่างระบบ

**APM (Application Performance Monitoring)**
การติดตามประสิทธิภาพของแอปพลิเคชัน

**Async (Asynchronous)**
การทำงานแบบไม่ต้องรอให้งานก่อนหน้าเสร็จก่อน

**Attachment**
ไฟล์แนบที่อยู่กับเอกสาร เช่น PDF, Word, Drawing files

**Audit Log**
บันทึกการกระทำของผู้ใช้ในระบบเพื่อการตรวจสอบ

**Authentication**
การยืนยันตัวตนผู้ใช้ (Login)

**Authorization**
การกำหนดสิทธิ์การเข้าถึง

---

### B

**Backend**
ส่วนของระบบที่ทำงานฝั่งเซิร์ฟเวอร์ จัดการข้อมูลและ Business Logic

**Backup**
การสำรองข้อมูล

**Blue-Green Deployment**
กลยุทธ์การ Deploy โดยมี 2 สภาพแวดล้อม (Blue และ Green) สลับกันใช้งาน

**BullMQ**
Message Queue library สำหรับ Node.js ที่ใช้ Redis

---

### C

**Cache**
ที่เก็บข้อมูลชั่วคราวเพื่อเพิ่มความเร็วในการเข้าถึง

**CASL (Component Ability Serialization Language)**
Library สำหรับจัดการ Authorization และ Permissions

**CI/CD (Continuous Integration / Continuous Deployment)**
กระบวนการอัตโนมัติในการ Build, Test และ Deploy code

**ClamAV**
Antivirus software แบบ Open-source สำหรับสแกนไวรัส

**Container**
หน่วยของ Software ที่รวม Application และ Dependencies ทั้งหมด

**CORS (Cross-Origin Resource Sharing)**
กลไกที่อนุญาตให้เว็บคุยข้ามโดเมน

**CRUD (Create, Read, Update, Delete)**
การดำเนินการพื้นฐานกับข้อมูล

---

### D

**Database Migration**
การเปลี่ยนแปลง Schema ของฐานข้อมูลอย่างเป็นระบบ

**DBA (Database Administrator)**
ผู้ดูแลระบบฐานข้อมูล

**DevOps**
แนวทางที่รวม Development และ Operations เข้าด้วยกัน

**Discipline**
สาขาวิชาชีพ เช่น GEN (General), STR (Structure), ARC (Architecture)

**DMS (Document Management System)**
ระบบจัดการเอกสาร

**Docker**
Platform สำหรับพัฒนาและรัน Application ใน Container

**DTO (Data Transfer Object)**
Object ที่ใช้สำหรับส่งข้อมูลระหว่าง Layer ต่างๆ

**DSL (Domain-Specific Language)**
ภาษาที่ออกแบบมาสำหรับโดเมนเฉพาะ

---

### E

**Elasticsearch**
Search Engine แบบ Distributed สำหรับ Full-text Search

**Entity**
Object ที่แทนตารางในฐานข้อมูล (TypeORM)

**ENV (Environment)**
สภาพแวดล้อมการทำงาน เช่น Development, Staging, Production

**Escalation**
การส่งต่อเรื่องไปยังผู้มีอำนาจสูงขึ้น

---

### F

**Foreign Key (FK)**
คีย์ที่เชื่อมโยงระหว่างตาราง

**Frontend**
ส่วนของระบบที่ผู้ใช้โต้ตอบได้ (User Interface)

---

### G

**Guard**
Middleware ใน NestJS ที่ใช้ตรวจสอบ Authorization

**GUI (Graphical User Interface)**
ส่วนติดต่อผู้ใช้แบบกราฟิก

---

### H

**Health Check**
การตรวจสอบสถานะของ Service ว่าทำงานปกติหรือไม่

**Hot Reload**
การ Reload code โดยไม่ต้อง Restart server

---

### I

**Idempotency**
การดำเนินการที่ให้ผลลัพธ์เดียวกันไม่ว่าจะทำกี่ครั้ง

**Incident**
เหตุการณ์ที่ทำให้ระบบไม่สามารถทำงานได้ตามปกติ

**Index**
โครงสร้างข้อมูลที่ช่วยเพิ่มความเร็วในการค้นหา (Database)

**Interceptor**
Middleware ใน NestJS ที่ดัก Request/Response

---

### J

**JWT (JSON Web Token)**
มาตรฐานสำหรับ Token-based Authentication

---

### K

**Key-Value Store**
ฐานข้อมูลที่เก็บข้อมูลในรูปแบบ Key และ Value (เช่น Redis)

---

### L

**LCBP3 (Laem Chabang Port Phase 3)**
โครงการท่าเรือแหลมฉบังระยะที่ 3

**Load Balancer**
ตัวกระจายโหลดไปยัง Server หลายตัว

**Lock**
กลไกป้องกันการเข้าถึงข้อมูลพร้อมกัน

**Log**
บันทึกเหตุการณ์ที่เกิดขึ้นในระบบ

---

### M

**MariaDB**
ฐานข้อมูล Relational แบบ Open-source

**Master Data**
ข้อมูลหลักของระบบ เช่น Organizations, Projects

**Master-Revision Pattern**
รูปแบบการจัดเก็บข้อมูลที่มี Master record และ Revision records

**Microservices**
สถาปัตยกรรมที่แบ่งระบบเป็น Service เล็กๆ หลายตัว

**Migration**
การย้ายหรือเปลี่ยนแปลง Schema ของฐานข้อมูล

**Modular Monolith**
Monolithic application ที่แบ่งโมดูลชัดเจน

**MTBF (Mean Time Between Failures)**
เวลาเฉลี่ยระหว่างความล้มเหลว

**MTTR (Mean Time To Resolution/Repair)**
เวลาเฉลี่ยในการแก้ไขปัญหา

**MVP (Minimum Viable Product)**
ผลิตภัณฑ์ขั้นต่ำที่ใช้งานได้

---

### N

**NestJS**
Framework สำหรับสร้าง Backend Node.js application

**Next.js**
Framework สำหรับสร้าง React application

**NGINX**
Web Server และ Reverse Proxy

---

### O

**ORM (Object-Relational Mapping)**
เทคนิคแปลง Object เป็น Relational Database

**Optimistic Locking**
กลไกป้องกัน Concurrent update โดยใช้ Version

---

### P

**Pessimistic Locking**
กลไกป้องกัน Concurrent access โดย Lock ทันที

**PIR (Post-Incident Review)**
การทบทวนหลังเกิดปัญหา

**Primary Key (PK)**
คีย์หลักของตาราง

**Production**
สภาพแวดล้อมที่ผู้ใช้จริงใช้งาน

---

### Q

**QNAP**
ยี่ห้อ NAS (Network Attached Storage)

**Queue**
แถวลำดับงานที่รอการประมวลผล

---

### R

**Race Condition**
สถานการณ์ที่ผลลัพธ์ขึ้นกับลำดับเวลาการทำงาน

**RBAC (Role-Based Access Control)**
การควบคุมการเข้าถึงตามบทบาท

**Redis**
In-memory Key-Value store สำหรับ Cache และ Queue

**Repository Pattern**
รูปแบบการออกแบบสำหรับการเข้าถึงข้อมูล

**REST (Representational State Transfer)**
สถาปัตยกรรม API ที่ใช้ HTTP

**Rollback**
การย้อนกลับไปสถานะก่อนหน้า

**RPO (Recovery Point Objective)**
จุดเวลาที่ยอมรับได้สำหรับการกู้คืนข้อมูล

**RTO (Recovery Time Objective)**
เวลาที่ยอมรับได้สำหรับการกู้คืนระบบ

---

### S

**Seed Data**
ข้อมูลเริ่มต้นที่ใส่ในฐานข้อมูล

**Session**
ช่วงเวลาที่ผู้ใช้ Login อยู่

**Soft Delete**
การลบข้อมูลโดยทำ Mark แทนการลบจริง

**SQL (Structured Query Language)**
ภาษาสำหรับจัดการฐานข้อมูล

**SSL/TLS (Secure Sockets Layer / Transport Layer Security)**
โปรโตคอลสำหรับการเข้ารหัสข้อมูล

**Staging**
สภาพแวดล้อมสำหรับทดสอบก่อน Production

**State Machine**
โมเดลที่มีหลาย State และ Transition

---

### T

**Temp (Temporary)**
ชั่วคราว

**Transaction**
ชุดการดำเนินการที่ต้องสำเร็จทั้งหมดหรือไม่ทำเลย

**Two-Phase Storage**
การจัดเก็บไฟล์แบบ 2 ขั้นตอน (Temp → Permanent)

**TypeORM**
ORM สำหรับ TypeScript/JavaScript

**TypeScript**
ภาษาโปรแกรมที่เป็น Superset ของ JavaScript พร้อม Static Typing

---

### U

**UAT (User Acceptance Testing)**
การทดสอบโดยผู้ใช้จริง

**UUID (Universally Unique Identifier)**
รหัสไม่ซ้ำกัน 128-bit

---

### V

**Validation**
การตรวจสอบความถูกต้องของข้อมูล

**Version Control**
การควบคุมเวอร์ชันของ Code (เช่น Git)

**Volume**
พื้นที่เก็บข้อมูลถาวรใน Docker

---

### W

**Webhook**
HTTP Callback ที่เรียกเมื่อเกิด Event

**Winston**
Logging library สำหรับ Node.js

**Workflow**
ลำดับขั้นตอนการทำงาน

---

## 🏗️ Project-Specific Terms (คำศัพท์เฉพาะโครงการ)

### Organizations (องค์กร)

**กทท. (Port Authority of Thailand)**
การท่าเรือแห่งประเทศไทย - เจ้าของโครงการ

**สค©. (Supervision Consultant)**
สำนักงานโครงการ ท่าเรือแหลมฉบัง

**TEAM (Design Consultant)**
ที่ปรึกษาออกแบบ

**คคง. (Construction Supervision)**
ที่ปรึกษาควบคุมงานก่อสร้าง

**ผรม. (Contractor)**
ผู้รับเหมาก่อสร้าง

---

### Document Types

**Correspondence**
เอกสารโต้ตอบ / หนังสือราชการ

**RFA (Request for Approval)**
เอกสารขออนุมัติ

**Contract Drawing**
แบบคู่สัญญา

**Shop Drawing**
แบบก่อสร้าง

**Transmittal**
เอกสารนำส่ง

**Circulation Sheet**
ใบเวียนเอกสารภายใน

---

### Workflow States

**Draft**
ร่างเอกสาร

**Pending**
รอดำเนินการ

**In Review**
อยู่ระหว่างตรวจสอบ

**Approved**
อนุมัติ

**Rejected**
ไม่อนุมัติ

**Closed**
ปิดเรื่อง

**Lead Engineer**
บทบาทวิศวกรอาวุโสที่มีอำนาจอนุมัติทางเทคนิคในระบบ RFA

**Parallel Review**
กระบวนการตรวจสอบเอกสารพร้อมกันหลายบุคคลในขั้นตอนเดียวกัน (Workflow Engine)

**Polymorphic Distribution**
การกระจายเอกสารที่ผู้รับสามารถเป็นได้ทั้ง User หรือ Role (ADR-019)

---

### Disciplines (สาขาวิชาชีพ)

**GEN - General**
ทั่วไป

**STR - Structure**
โครงสร้าง

**ARC - Architecture**
สถาปัตยกรรม

**MEP - Mechanical, Electrical & Plumbing**
ระบบเครื่องกล ไฟฟ้า และสุขาภิบาล

**CIV - Civil**
โยธา

---

## 📚 Acronyms Reference (อ้างอิงตัวย่อ)

| Acronym | Full Form                         | Thai                            |
| ------- | --------------------------------- | ------------------------------- |
| ADR     | Architecture Decision Record      | บันทึกการตัดสินใจทางสถาปัตยกรรม |
| API     | Application Programming Interface | ส่วนต่อประสานโปรแกรม            |
| CRUD    | Create, Read, Update, Delete      | สร้าง อ่าน แก้ไข ลบ             |
| DMS     | Document Management System        | ระบบจัดการเอกสาร                |
| DTO     | Data Transfer Object              | วัตถุถ่ายโอนข้อมูล              |
| JWT     | JSON Web Token                    | โทเคนเว็บ JSON                  |
| LCBP3   | Laem Chabang Port Phase 3         | ท่าเรือแหลมฉบังระยะที่ 3        |
| MVP     | Minimum Viable Product            | ผลิตภัณฑ์ขั้นต่ำที่ใช้งานได้    |
| ORM     | Object-Relational Mapping         | การแมปวัตถุกับฐานข้อมูล         |
| RBAC    | Role-Based Access Control         | การควบคุมการเข้าถึงตามบทบาท     |
| REST    | Representational State Transfer   | การถ่ายโอนสถานะแบบนำเสนอ        |
| RFA     | Request for Approval              | เอกสารขออนุมัติ                 |
| RTO     | Recovery Time Objective           | เวลาเป้าหมายในการกู้คืน         |
| RPO     | Recovery Point Objective          | จุดเป้าหมายในการกู้คืน          |
| UAT     | User Acceptance Testing           | การทดสอบการยอมรับของผู้ใช้      |

---

**Version:** 1.9.0
**Last Updated:** 2026-05-13
**Next Review:** 2026-08-13
