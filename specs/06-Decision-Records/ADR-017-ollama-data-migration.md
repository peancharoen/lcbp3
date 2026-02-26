# ADR-017: Ollama Data Migration Architecture

**Status:** Accepted
**Date:** 2026-02-26
**Decision Makers:** Development Team, DevOps Engineer
**Related Documents:**

- [Legacy Data Migration Plan](../03-Data-and-Storage/03-04-legacy-data-migration.md)
- [Software Architecture](../02-Architecture/02-02-software-architecture.md)
- [Data Dictionary](../03-Data-and-Storage/03-01-data-dictionary.md)

---

## Context and Problem Statement

โครงการ LCBP3-DMS มีความจำเป็นต้องนำเข้าเอกสาร (Data Migration) ประเภท PDF เก่าจำนวนกว่า 20,000 ฉบับ ซึ่งมาพร้อมกับ Metadata ในรูปแบบไฟล์ Excel เข้าสู่ระบบใหม่เพื่อให้สามารถเริ่มใช้งานได้อย่างสมบูรณ์

ความท้าทายหลักของการทำ Migration ชุดนี้คือ **Data Integrity และความถูกต้องของ Metadata** เนื่องจากเป็นข้อมูลเก่าที่มีโอกาสเกิด Human Error ในขั้นตอนการจัดทำ Index (เช่น ชื่อไฟล์ หรือ Document Number พิมพ์ผิด) เราจึงต้องการเครื่องมืออัตโนมัติมาช่วย Validate เอกสารและจำแนกประเภทก่อนการนำเข้า

ทว่าการส่งข้อมูล 20,000 รายการ ขึ้นไปวิเคราะห์บน Cloud AI Provider (เช่น OpenAI, Anthropic) มีปัญหาใหญ่ 2 ประการ:
1. **Data Privacy / Confidentiality:** เอกสารก่อสร้างท่าเรือเป็นข้อมูลความลับ ไม่ควรส่งขึ้น Public API
2. **Cost:** ค่าใช้จ่ายต่อ Token ในการวิเคราะห์เอกสารจำนวนมากจะสูงเกินความจำเป็น

---

## Decision Drivers

- **Security & Privacy:** ต้องเก็บข้อมูลและประมวลผลภายในระบบเครือข่ายภายในองค์กร (On-Premise)
- **Cost Effectiveness:** ไม่เสียค่าใช้จ่ายแบบ Pay-per-use (API Costs) ไม่จำกัดจำนวน Request
- **Performance:** ต้องสามารถประมวลผลได้อย่างรวดเร็วในระยะเวลาที่จำกัด
- **Maintainability:** เครื่องมือ Migration ต้องแยก Context ออกจาก Core Application (ไม่นำไปเขียนเป็น Script ฝังใน NestJS เพื่อทำงานชั่วคราว)

---

## Considered Options

### Option 1: NestJS Custom Script + Public AI API

**แนวทาง:** เขียน Script ชั่วคราวใน NestJS อ่านไฟล์ Excel และยิง API ไปยัง OpenAI/Anthropic เพื่อตรวจสอบ

**Pros:**
- ไม่ต้องจัดหา Hardware เพิ่มเติมสำหรับประมวลผล AI
- AI มีความฉลาดสูง (GPT-4 / Claude 3)

**Cons:**
- ❌ ผิดนโยบายเรื่อง Data Privacy
- ❌ มีค่าใช้จ่ายต่อเนื่องตามจำนวน Token ที่ประมวลผล
- ❌ โค้ดสกปรก: นำ Script การทำงานชั่วคราวไปปะปนกับ Source Code หลักของ Application

### Option 2: Pure Scripting (No AI)

**แนวทาง:** เขียน Script ตรวจสอบ Format โดยใช้ Regular Expressions เช็คความยาวหรือ Pattern ของข้อความเท่านั้น

**Pros:**
- เร็วมาก และไม่มีค่าใช้จ่าย

**Cons:**
- ❌ ความแม่นยำต่ำ: ทราบเพียงว่า Format ตรง แต่ไม่ทราบว่าความหมายของชื่อเรื่อง สอดคล้องกับประเภทเอกสารและเอกสารอ้างอิงหรือไม่
- ❌ ต้องใช้แรงงานคน (Manual Review) กลับมาสุ่มตรวจหรือแก้ไขข้อผิดพลาดจำนวนมากหลังนำเข้า

### Option 3: Local AI Model (Ollama) + n8n Workflow Automation ⭐ (Selected)

**แนวทาง:** จำลอง Workflow การ Migration ผ่าน n8n (ซึ่งติดตั้งอยู่บน QNAP NAS ของระบบอยู่แล้ว) และใช้ Ollama รัน Local Language Model (เช่น LLaMA 3.2 หรือ Mistral) โดยประมวลผลบนเครื่อง Desktop PC ที่มี GPU (เช่น RTX 2060 SUPER) ภายในเครือข่าย Local Network เดียวกัน ความเร็วในการส่งไฟล์ผ่าน 2.5G LAN

**Pros:**
- ✅ **Privacy Guaranteed:** ข้อมูลไม่รั่วไหลออกสู่อินเทอร์เน็ต
- ✅ **Zero Cost:** ใช้ Hardware ที่มีอยู่แล้ว ไม่มีค่าใช้จ่ายด้าน Token
- ✅ **Clean Architecture:** กระบวนการทำ Migration ถูกแยกออกจากการพัฒนาซอฟต์แวร์หลักของระบบ (NestJS Backend รับผิดชอบแค่ Ingest API เท่านั้น)
- ✅ **Visual & Debuggable:** n8n ช่วยให้มองเห็น Flow การทำงานแบบเป็นภาพ (Visual Node Editor) จัดการ Batch, Retry และดู Error Logs ได้ง่าย

**Cons:**
- ❌ จำเป็นต้องเปิดคอมพิวเตอร์ Desktop ทิ้งไว้ และควบคุมอุณหภูมิ GPU ในช่วงที่ทำ Migration

---

## Decision Outcome

**Chosen Option:** Option 3 - Local AI Model (Ollama) + n8n Workflow Automation

### Rationale

เราเลือกแนวทางนี้เพราะเป็นการประยุกต์ใช้ทรัพยากรที่มีอยู่ให้เกิดประโยชน์สูงสุด โดยไม่ขัดหลักการด้าน Cybersecurity และ Privacy ของโครงการ การนำ Automation Tool (n8n) แยกออกมาเป็น Orchestrator ช่วยลดความเสี่ยงที่การรัน Migration script ขนาดใหญ่จะไปส่งผลกระทบให้ Core Backend (NestJS) ของระบบในฝั่ง Production หยุดชะงัก (Downtime) หรือ Memory รั่ว

---

## Implementation Summary

- **Migration Orchestrator:** n8n (Docker container ภายในระบบ Infrastructure เดิม)
- **AI Brain:** Ollama Native (รันนอก Environment หลัก บน Hardware แยกเพื่อรับโหลด AI โดยตรง)
- **Data Ingestion:** ส่งผ่าน RESTful API ของ LCBP3-DMS Backend (พร้อม Token สิทธิพิเศษ)

*หมายเหตุ: สำหรับขั้นตอนปฏิบัติงานแบบละเอียด โปรดดูที่ไฟล์ `03-04-legacy-data-migration.md`*
