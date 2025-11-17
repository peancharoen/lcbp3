# Documents Management Sytem Version 1.1.0: Application Databases Specification
## 1. วัตถุประสงค์


## 2. สถาปัตยกรรมและเทคโนโลยี (System Architecture & Technology Stack)
correspondences ตารางเอกสารโต้ตอบ
-- 2.7.5 : n.n.5 for shop_drawing
 shop_drawings;
-- 2.6.6 : n.n.6 for contract_drawing
 contract_drawings;
-- 2.5.2 : n.n.2 for rfa
 rfas;
-- 2.4.4 : n.n.4 for transmittal
 transmittals;
-- 2.3.3: n.n.3 for circulation
 circulations;
                     

 users; 
-- 4.7
 projects ตารางโครงการ
-- 4.6
 contracts ตารางสัญญา
-- 4.2
 permissions;
-- 4.1
 roles;

-- Level 5: ตารางที่เป็นรากฐานที่สุด
-- 5.2
 organizations ตารางองกรณ์;
-- 5.1
 organization_roles;

-- 1.2
 attachments;
                           
-- 1.1
 global_default_roles;

 audit_logs;


ใช้สถาปัตยกรรมแบบ Headless/API-First ที่ทันสมัย ทำงานทั้งหมดบน QNAP Server ผ่าน Container Station เพื่อความสะดวกในการจัดการและบำรุงรักษา,  Domain: np-dms.work, มี fix ip, รัน docker command ใน application ของ Container Station ได้โดยตรง, ประกอบด้วย

* 2.1. Infrastructure & Environment:
    - Server: QNAP (Model: TS-473A, RAM: 32GB, CPU: AMD Ryzen V1500B)
    - Containerization: Container Station (Docker & Docker Compose) ใช้ UI ของ Container Station เป็นหลัก ในการ configuration และการรัน docker command
    - Development Environment: VS Code on Windows 11
    - Domain: np-dms.work, www.np-dms.work
    - ip: 159.192.126.103
    - Docker Network: ทุก Service จะเชื่อมต่อผ่านเครือข่ายกลางชื่อ lcbp3 เพื่อให้สามารถสื่อสารกันได้
    - Data Storage: /share/dms-data บน QNAP
    - ข้อจำกัด: ไม่สามารถใช้ .env ในการกำหนดตัวแปรภายนอกได้ ต้องกำหนดใน docker-compose.yml เท่านั้น
*