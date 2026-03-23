# 🚀 Web Developer Prompt Library (Comprehensive Edition)
คลังคำสั่ง AI สำหรับการพัฒนา Software ตั้งแต่เริ่มต้นวางกลยุทธ์จนถึงการส่งมอบงาน โดยแบ่งตามบทบาทหน้าที่ในทีมพัฒนา

---

## 🏗️ 1. กลุ่มการวางแผนและวิเคราะห์ (Planning & Analysis)
*เหมาะสำหรับช่วงเริ่มโปรเจกต์ หรือต้องการสรุปภาพรวมระบบก่อนลงมือทำ*

### 🟡 Product Owner (PO) / Strategist
**หน้าที่:** วิเคราะห์ Business Value, กลุ่มเป้าหมาย และกำหนด MVP
> **Prompt:** > ให้คุณรับบทเป็น Product Owner สำหรับโปรเจกต์ [ชื่อโปรเจกต์] ช่วยวิเคราะห์เป้าหมายธุรกิจ กลุ่มผู้ใช้หลัก ปัญหาที่ผู้ใช้เจอ และเสนอฟีเจอร์สำหรับ MVP สรุปออกมาเป็น:
> 1. เป้าหมายระบบ
> 2. กลุ่มผู้ใช้งาน
> 3. User pain points
> 4. Feature list
> 5. MVP scope
> 6. Future scope

### 🔵 Business Analyst (BA)
**หน้าที่:** แตก Requirement ให้ละเอียด ทั้งทางเทคนิคและทางธุรกิจ
> **Prompt:**
> ให้คุณรับบทเป็น Business Analyst ช่วยวิเคราะห์ requirement ของ [ระบบ] แยกเป็น:
> - Functional / Non-functional requirements
> - User roles & Use cases
> - Business rules & Edge cases
> - Assumptions / Open questions
> Output: รายการฟีเจอร์, Roadmap และเอกสาร Requirement

### ⚪ AI Project Manager (Orchestrator)
**หน้าที่:** วางแผนการทำงาน แบ่งเฟส และจัดการ Dependency
> **Prompt:**
> ให้คุณรับบทเป็น AI Project Manager ช่วยแบ่งการพัฒนาเว็บไซต์ [ชื่อโปรเจกต์] เป็น phase โดยสรุป: งานแต่ละ phase, ลำดับก่อนหลัง, dependency, ผลลัพธ์ที่ต้องได้ และ Definition of Done

---

## 🎨 2. กลุ่มการออกแบบประสบการณ์ (UX/UI & IA)
*เน้นการคิดจากมุมมองผู้ใช้งานและการจัดระเบียบข้อมูล*

### 🟣 UX Researcher
**หน้าที่:** วิเคราะห์พฤติกรรมผู้ใช้และสร้างเส้นทางการใช้งาน
> **Prompt:**
> ให้คุณรับบทเป็น UX Researcher วิเคราะห์ประสบการณ์ผู้ใช้สำหรับ [ประเภทเว็บ] ที่มีกลุ่มเป้าหมายเป็น [กลุ่มผู้ใช้] ช่วยสร้าง: User persona 3 แบบ, User journey, Pain points และ UX opportunities

### 🟢 Information Architect (IA)
**หน้าที่:** วางโครงสร้างเมนูและการจัดหมวดหมู่เนื้อหา
> **Prompt:**
> ให้คุณรับบทเป็น Information Architect ช่วยออกแบบ sitemap ของเว็บไซต์ [ประเภทเว็บ] โดยมีฟีเจอร์หลักคือ [รายการ] ส่งออกเป็น: Primary/Secondary navigation, Sitemap และ Content grouping

### 🔴 UX/UI Designer
**หน้าที่:** วาง Layout, UI Components และ Design Guideline
> **Prompt:**
> ให้คุณรับบทเป็น UX/UI Designer ออกแบบหน้า [ชื่อหน้า] สำหรับ [ประเภทเว็บ] เพื่อเป้าหมาย [เช่น เพิ่มยอดสมัคร] ช่วยเสนอ: โครงสร้างหน้า, ลำดับ section, UI components, แนวทางสี/ฟอนต์ และ Wireframe แบบ text layout

---

## 💻 3. กลุ่มการพัฒนา (Development & Architecture)
*เน้นการเขียนโค้ดและการวางโครงสร้างระบบ*

### 🛠️ Solution Architect
**หน้าที่:** ออกแบบโครงสร้างระบบภาพรวม (High-level) เน้น Scalability
> **Prompt:**
> ให้คุณรับบทเป็น Solution Architect ช่วยออกแบบ architecture สำหรับระบบ [ประเภทระบบ] ที่รองรับผู้ใช้ [จำนวน] ต้องคำนึงถึง: Scalability, Security, Data flow และ Recommended stack

### 🚀 Full Stack Developer
**หน้าที่:** ออกแบบและเขียนโค้ดทั้งหน้าบ้านและหลังบ้าน
> **Prompt:**
> ให้คุณรับบทเป็น Senior Full Stack Developer ช่วยออกแบบและพัฒนาระบบ [ชื่อระบบ] ด้วย Tech stack: [ระบุ] โปรดส่งออกเป็น: System architecture, Folder structure, Database schema, API design และขั้นตอนการเชื่อมต่อ

### 🔹 Frontend / Backend Developer
**หน้าที่:** เจาะลึกการเขียนโค้ดเฉพาะส่วน (Logic, API, UI)
> **Prompt (Frontend):** สร้างหน้า [ชื่อหน้า] ด้วย [เช่น React + Tailwind] เงื่อนไข: Responsive, แยก component, รองรับ Loading/Error state
> **Prompt (Backend):** ออกแบบ REST API สำหรับ [ระบบ] ด้วย [เช่น Node.js] ต้องมี: Validation, Error handling, Auth และ Database schema

---

## 🛡️ 4. กลุ่มความเสถียรและความปลอดภัย (Infra, Security & QA)
*การเตรียมระบบให้พร้อมใช้งานจริงและทนทานต่อข้อผิดพลาด*

### 🗄️ Database Designer
**หน้าที่:** ออกแบบ Schema, ความสัมพันธ์ข้อมูล และการทำ Index
> **Prompt:**
> ให้คุณรับบทเป็น Database Designer ออกแบบฐานข้อมูลสำหรับ [ชื่อระบบ] ระบุ: ตารางทั้งหมด, ฟิลด์/ชนิดข้อมูล, Primary/Foreign key, ความสัมพันธ์ และตัวอย่าง SQL schema

### ☁️ DevOps Engineer
**หน้าที่:** การ Deployment, Docker และ CI/CD
> **Prompt:**
> ให้คุณรับบทเป็น DevOps Engineer ช่วยวางแผน deployment สำหรับเว็บ [ประเภทเว็บ] ที่ใช้ [stack] ต้องการ: Docker setup, CI/CD pipeline, Nginx config และ Backup strategy

### 🔍 QA / Security Engineer
**หน้าที่:** ทดสอบระบบและตรวจสอบช่องโหว่ความปลอดภัย
> **Prompt (QA):** สร้าง Test cases สำหรับ [ฟีเจอร์] ครอบคลุม: Happy path, Edge cases, และ Error cases ในรูปแบบตาราง
> **Prompt (Security):** ตรวจสอบความเสี่ยงของ [ระบบ] วิเคราะห์: Auth/AuthZ risks, Input validation และ Common OWASP risks

---

## 📝 5. กลุ่มการปรับปรุงและเอกสาร (Optimization & Review)
*การทำความสะอาดโค้ดและการส่งต่องาน*

### 🧐 Senior Code Reviewer
**หน้าที่:** ตรวจสอบคุณภาพโค้ดและแนะนำแนวทาง Refactor
> **Prompt:**
> ให้คุณรับบทเป็น Senior Code Reviewer ช่วย review โค้ดนี้ในมุม: Readability, Maintainability, Performance และ Security พร้อมส่งเวอร์ชัน Refactor

### 📖 Technical Writer
**หน้าที่:** เขียนคู่มือการติดตั้งและการใช้งาน API
> **Prompt:**
> ให้คุณรับบทเป็น Technical Writer ช่วยเขียนเอกสารสำหรับโปรเจกต์นี้: Project overview, Installation steps, Env variables และ API summary ให้อ่านง่ายสำหรับ Dev ใหม่

### ⚡ Performance / SEO Specialist
**หน้าที่:** ทำให้เว็บเร็วขึ้นและติดอันดับการค้นหา
> **Prompt (Performance):** เสนอแนวทางเพิ่มความเร็วเว็บ [ประเภทเว็บ] วิเคราะห์ Caching, Asset optimization และ Core Web Vitals
> **Prompt (SEO):** วางกลยุทธ์ SEO: Keyword clusters, Meta description และ Heading structure

---

ดีเลย แบบนี้จะได้ “ของที่ใช้จริง” 🔥
ผมจัดให้เป็น **Ultimate Prompt Library – AI + Automation (DMS Edition)**
โฟกัสตรง use case ของคุณโดยตรง:

```
OCR
Document Management System (DMS)
RAG
n8n automation
AI tagging
workflow เอกสารก่อสร้าง
```

ทั้งหมดเป็น **⭐ Production Prompt Templates** (ไม่ใช่ prompt สั้น ๆ)

---

# 🚀 Ultimate Prompt Library – AI + Automation (DMS Edition)

ใช้สำหรับระบบ

```
Document Control
Drawing Management
RFA / Transmittal
AI Search / Tagging
```

---

# 🧭 1. Document Classification (AI Tagging)

## ⭐ Prompt: Intelligent Document Classification

**Role**
Senior AI Document Analyst

---

**Context**

เรามีเอกสารจากโครงการก่อสร้าง เช่น

```
Drawings
RFAs
Transmittals
Contracts
Reports
```

Input คือ text ที่ extract จาก OCR:

```
[document_text]
```

---

**Objective**

จำแนกประเภทเอกสาร + สร้าง metadata

---

**Instructions**

1 วิเคราะห์เนื้อหา
2 ระบุ document type
3 extract key metadata
4 สร้าง tags

---

**Constraints**

* ต้อง robust ต่อ OCR error
* รองรับภาษาไทย + อังกฤษ
* หลีกเลี่ยง hallucination

---

**Output Format (JSON)**

```json
{
  "document_type": "",
  "confidence": 0.0,
  "title": "",
  "document_number": "",
  "revision": "",
  "date": "",
  "discipline": "",
  "tags": [],
  "entities": {
    "project": "",
    "company": "",
    "person": ""
  }
}
```

---

**Quality Criteria**

* ไม่เดาเมื่อข้อมูลไม่ชัด
* ใช้ confidence ต่ำแทน

---

# 📄 2. Drawing Metadata Extraction

## ⭐ Prompt: Drawing Parser

**Role**
Engineering Document Specialist

---

**Context**

Drawing text จาก OCR:

```
[ocr_text]
```

---

**Objective**

extract ข้อมูล drawing

---

**Instructions**

ค้นหา:

```
drawing number
revision
title
scale
discipline
status
```

---

**Output Format**

```json
{
  "drawing_no": "",
  "title": "",
  "revision": "",
  "scale": "",
  "discipline": "",
  "status": "",
  "sheet_no": ""
}
```

---

# 📑 3. RFA Analysis

## ⭐ Prompt: RFA Intelligence

**Role**
Construction Document Analyst

---

**Context**

RFA content:

```
[rfa_text]
```

---

**Objective**

สรุป + วิเคราะห์

---

**Instructions**

1 สรุปเนื้อหา
2 ระบุคำถาม
3 ระบุความเสี่ยง
4 เชื่อมโยง drawing

---

**Output Format**

### Summary

---

### Questions

---

### Risk Analysis

| Risk | Impact |

---

### Related Drawings

---

# 🔗 4. Document Linking (AI)

## ⭐ Prompt: Smart Document Linking

**Role**
AI Knowledge Graph Engineer

---

**Context**

เอกสารหลายรายการ:

```
[list_of_documents]
```

---

**Objective**

หา relationship ระหว่างเอกสาร

---

**Instructions**

1 วิเคราะห์ document number
2 วิเคราะห์ reference
3 match ความสัมพันธ์

---

**Output Format**

```json
[
  {
    "source": "",
    "target": "",
    "relationship": "references / revision / related"
  }
]
```

---

# 📚 5. RAG for DMS

## ⭐ Prompt: DMS RAG Design

**Role**
AI Retrieval Architect

---

**Context**

ระบบ DMS ต้องค้นหาเอกสารจาก

```
PDF
OCR text
metadata
```

---

**Objective**

ออกแบบ RAG system

---

**Instructions**

ออกแบบ

```
chunking strategy
embedding
metadata filtering
retrieval ranking
```

---

**Output Format**

### Architecture

---

### Chunking Strategy

---

### Retrieval Strategy

---

### Query Flow

---

# 🤖 6. AI Search Query Understanding

## ⭐ Prompt: Query Understanding

**Role**
Search AI Engineer

---

**Context**

User query:

```
[user_query]
```

---

**Objective**

แปลง query เป็น structured search

---

**Output Format**

```json
{
  "intent": "",
  "filters": {
    "document_type": "",
    "discipline": "",
    "date_range": ""
  },
  "keywords": []
}
```

---

# 🔄 7. n8n Workflow Design

## ⭐ Prompt: Automation Workflow

**Role**
Workflow Automation Architect

---

**Context**

Flow:

```
Upload → OCR → AI → Save DB → Notify
```

---

**Objective**

ออกแบบ workflow

---

**Output Format**

### Workflow Steps

| Step | Tool | Description |

---

### Error Handling

---

### Retry Strategy

---

# 🧾 8. OCR Pipeline Optimization

## ⭐ Prompt: OCR Pipeline

**Role**
Document AI Engineer

---

**Objective**

ปรับปรุง OCR accuracy

---

**Instructions**

วิเคราะห์

```
image quality
language detection
post-processing
```

---

**Output Format**

### Problems

---

### Improvements

---

# 🏗️ 9. DMS Database Design

## ⭐ Prompt: DMS Schema

**Role**
Senior Database Architect

---

**Objective**

ออกแบบ schema สำหรับ DMS

---

**Output Format**

### Tables

| Table | Purpose |

---

### Relationships

---

### Index Strategy

---

# ⚙️ 10. File Storage Strategy

## ⭐ Prompt: File Storage Design

**Role**
Cloud Storage Architect

---

**Objective**

ออกแบบ file storage

---

**Output Format**

### Storage Structure

---

### Naming Convention

---

### Access Control

---

# 🛡️ 11. Document Security

## ⭐ Prompt: DMS Security

**Role**
Security Engineer

---

**Objective**

ป้องกัน document leakage

---

**Output Format**

### Risks

---

### Controls

---

# 📊 12. Audit & Version Control

## ⭐ Prompt: Audit Log Design

**Role**
System Architect

---

**Objective**

ออกแบบ audit log

---

**Output Format**

### Events

---

### Schema

---

# 📈 13. AI Tag Quality Improvement

## ⭐ Prompt: Tag Optimization

**Role**
ML Engineer

---

**Objective**

ปรับปรุง tag accuracy

---

**Output Format**

### Issues

---

### Improvements

---

# ⭐ Master Prompt (DMS AI System)

**Prompt**

ให้คุณรับบทเป็นทีม:

```
AI Architect
Document Controller
Backend Engineer
DevOps Engineer
```

ช่วยออกแบบระบบ:

```
AI-powered Document Management System
```

---

**Output**

```
1 Architecture
2 OCR pipeline
3 AI tagging
4 Database
5 Search (RAG)
6 Automation workflow
7 Security
```

---

# 📊 สรุป

Library นี้คือ

```
AI + Automation Prompt Playbook
```

ใช้ได้กับ:

```
DMS
Construction projects
OCR pipeline
AI search
n8n automation
```

---

# 🔥 จุดเด่น (สำคัญมาก)

นี่ไม่ใช่ prompt ธรรมดา แต่เป็น

```
Production Prompt System
```

ที่:

* ลด hallucination
* บังคับ output เป็น JSON/structure
* ใช้ต่อใน code ได้
* ใช้กับ pipeline จริงได้

---

💡 ถ้าคุณอยากไปสุดจริง ผมสามารถต่อยอดให้เป็น

```
AI DMS System Blueprint
```

ที่รวม

* DB schema (ตรงกับ prompt)
* API design
* n8n workflow JSON
* Docker setup
* RAG implementation

ซึ่งจะกลายเป็น **ระบบที่ build ได้จริงทั้งก้อน** 🚀

