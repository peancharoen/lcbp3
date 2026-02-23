# 3.1 Project Management (การจัดการโครงสร้างโครงการและองค์กร)

---

title: "Functional Requirements: Project Management"
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/01-requirements/01-01-objectives.md
- specs/02-architecture/README.md
- specs/01-requirements/01-03-modules/01-03-00-index.md

---

## Details (รายละเอียด)

- 3.1.1. โครงการ (Projects): ระบบต้องสามารถจัดการเอกสารภายในหลายโครงการได้ (ปัจจุบันมี 4 โครงการ และจะเพิ่มขึ้นในอนาคต)
- 3.1.2. สัญญา (Contracts): ระบบต้องสามารถจัดการเอกสารภายในแต่ละสัญญาได้ ในแต่ละโครงการ มีได้หลายสัญญา หรืออย่างน้อย 1 สัญญา
- 3.1.3. องค์กร (Organizations):
  - มีหลายองค์กรในโครงการ องค์กรณ์ที่เป็น Owner, Designer และ Consultant สามารถอยู่ในหลายโครงการและหลายสัญญาได้
  - Contractor จะถือ 1 สัญญา และอยู่ใน 1 โครงการเท่านั้น
