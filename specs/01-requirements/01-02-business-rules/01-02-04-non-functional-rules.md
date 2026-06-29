# 🛡️ Section 6: Non-Functional Requirements (ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงาน)

---

title: 'Non-Functional Requirements'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:

- specs/02-architecture/data-model.md#correspondence
- specs/03-implementation/backend-guidelines.md#correspondencemodule

---

## 6.1. การบันทึกการกระทำ (Audit Log)

- ทุกการกระทำที่สำคัญของผู้ใช้ (สร้าง, แก้ไข, ลบ, ส่ง) จะถูกบันทึกไว้ใน audit_logs เพื่อการตรวจสอบย้อนหลัง
  - ขอบเขตการบันทึก Audit Log:
    - ทุกการสร้าง/แก้ไข/ลบ ข้อมูลสำคัญ (correspondences, RFAs, drawings, users, permissions)
    - ทุกการเข้าถึงข้อมูล sensitive (user data, financial information)
    - ทุกการเปลี่ยนสถานะ workflow (status transitions)
    - ทุกการดาวน์โหลดไฟล์สำคัญ (contract documents, financial reports)
    - ทุกการเปลี่ยนแปลง permission และ role assignment
    - ทุกการล็อกอินที่สำเร็จและล้มเหลว
    - ทุกการส่งคำขอ API ที่สำคัญ
  - ข้อมูลที่ต้องบันทึกใน Audit Log:
    - ผู้ใช้งาน (user_id)
    - การกระทำ (action)
    - ชนิดของ entity (entity_type)
    - ID ของ entity (entity_id)
    - ข้อมูลก่อนการเปลี่ยนแปลง (old_values) - สำหรับ update operations
    - ข้อมูลหลังการเปลี่ยนแปลง (new_values) - สำหรับ update operations
    - IP address
    - User agent
    - Timestamp
    - Request ID สำหรับ tracing

## 6.2. Data Archiving & Partitioning

- สำหรับตารางที่มีขนาดใหญ่และโตเร็ว (เช่น `audit_logs`, `notifications`, `correspondence_revisions`) ต้องออกแบบโดยรองรับ **Table Partitioning** (แบ่งตาม Range วันที่ หรือ List) เพื่อประสิทธิภาพในระยะยาว

## 6.3. การค้นหา (Search):

- ระบบต้องมีฟังก์ชันการค้นหาขั้นสูง ที่สามารถค้นหาเอกสาร **correspondence**, **rfa**, **shop_drawing**, **contract-drawing**, **transmittal** และ **ใบเวียน (Circulations)** จากหลายเงื่อนไขพร้อมกันได้ เช่น ค้นหาจากชื่อเรื่อง, ประเภท, วันที่, และ Tag

## 6.4. การทำรายงาน (Reporting):

- สามารถจัดทำรายงานสรุปแยกประเภทของ Correspondence ประจำวัน, สัปดาห์, เดือน, และปีได้

## 6.5. ประสิทธิภาพ (Performance):

- มีการใช้ Caching กับข้อมูลที่เรียกใช้บ่อย และใช้ Pagination ในตารางข้อมูลเพื่อจัดการข้อมูลจำนวนมาก

- ตัวชี้วัดประสิทธิภาพ:
  - **API Response Time:** < 200ms (90th percentile) สำหรับ operation ทั่วไป
  - **Search Query Performance:** < 500ms สำหรับการค้นหาขั้นสูง
  - **File Upload Performance:** < 30 seconds สำหรับไฟล์ขนาด 50MB
  - **Concurrent Users:** รองรับผู้ใช้พร้อมกันอย่างน้อย 100 คน
  - **Database Connection Pool:** ขนาดเหมาะสมกับ workload (default: min 5, max 20 connections)
  - **Cache Hit Ratio:** > 80% สำหรับ cached data
  - **Application Startup Time:** < 30 seconds

- Caching Strategy:
  - **Master Data Cache:** Roles, Permissions, Organizations, Project metadata (TTL: 1 hour)
  - **User Session Cache:** User permissions และ profile data (TTL: 30 minutes)
  - **Search Result Cache:** Frequently searched queries (TTL: 15 minutes)
  - **File Metadata Cache:** Attachment metadata (TTL: 1 hour)
  - **Document Cache:** Frequently accessed document metadata (TTL: 30 minutes)
  - **ต้องมี cache invalidation strategy ที่ชัดเจน:**
    - Invalidate on update/delete operations
    - Time-based expiration
    - Manual cache clearance สำหรับ admin operations
  - ใช้ Redis เป็น distributed cache backend
  - ต้องมี cache monitoring (hit/miss ratios)

- Frontend Performance:
  - **Bundle Size Optimization:** ต้องควบคุมขนาด Bundle โดยรวมไม่เกิน 2MB
  - **State Management Efficiency:** ใช้ State Management Libraries อย่างเหมาะสม ไม่เกิน 2 ตัวหลัก
  - **Memory Management:** ต้องป้องกัน Memory Leak จาก State ที่ไม่จำเป็น

## 6.6. ความปลอดภัย (Security):

- มีระบบ Rate Limiting เพื่อป้องกันการโจมตีแบบ Brute-force
- การจัดการ Secret (เช่น รหัสผ่าน DB, JWT Secret) จะต้องทำผ่าน Environment Variable ของ Docker เพื่อความปลอดภัยสูงสุด
  - Rate Limiting Strategy:
    - **Anonymous Endpoints:** 100 requests/hour ต่อ IP address
    - **Authenticated Endpoints:**
      - Viewer: 500 requests/hour
      - Editor: 1000 requests/hour
      - Document Control: 2000 requests/hour
      - Admin/Superadmin: 5000 requests/hour
    - **File Upload Endpoints:** 50 requests/hour ต่อ user
    - **Search Endpoints:** 500 requests/hour ต่อ user
    - **Authentication Endpoints:** 10 requests/minute ต่อ IP address
    - **ต้องมี mechanism สำหรับยกเว้น rate limiting สำหรับ trusted services**
    - ต้องบันทึก log เมื่อมีการ trigger rate limiting
  - Error Handling และ Resilience:
    - ต้องมี circuit breaker pattern สำหรับ external service calls
    - ต้องมี retry mechanism ด้วย exponential backoff
    - ต้องมี graceful degradation เมื่อบริการภายนอกล้มเหลว
    - Error messages ต้องไม่เปิดเผยข้อมูล sensitive
  - Input Validation:
    - ต้องมี input validation ทั้งฝั่ง client และ server (defense in depth)
    - ต้องป้องกัน OWASP Top 10 vulnerabilities:
      - SQL Injection (ใช้ parameterized queries ผ่าน ORM)
      - XSS (input sanitization และ output encoding)
      - CSRF (CSRF tokens สำหรับ state-changing operations)
    - ต้อง validate file uploads:
      - File type (white-list approach)
      - File size
      - File content (magic number verification)
    - ต้อง sanitize user inputs ก่อนแสดงผลใน UI
    - ต้องใช้ content security policy (CSP) headers
    - ต้องมี request size limits เพื่อป้องกัน DoS attacks
  - Session และ Token Management:
    - **JWT token expiration:** 8 hours สำหรับ access token
    - **Refresh token expiration:** 7 days
    - **Refresh token mechanism:** ต้องรองรับ token rotation และ revocation
    - **Token revocation on logout:** ต้องบันทึก revoked tokens จนกว่าจะ expire
    - **Concurrent session management:**
      - จำกัดจำนวน session พร้อมกันได้ (default: 5 devices)
      - ต้องแจ้งเตือนเมื่อมี login จาก device/location ใหม่
    - **Device fingerprinting:** สำหรับ security และ audit purposes
    - **Password policy:**
      - ความยาวขั้นต่ำ: 8 characters
      - ต้องมี uppercase, lowercase, number, special character
      - ต้องเปลี่ยน password ทุก 90 วัน
      - ต้องป้องกันการใช้ password ที่เคยใช้มาแล้ว 5 ครั้งล่าสุด

## 6.7. การสำรองข้อมูลและการกู้คืน (Backup & Recovery)

- ระบบจะต้องมีกลไกการสำรองข้อมูลอัตโนมัติสำหรับฐานข้อมูล MariaDB [cite: 2.4] และไฟล์เอกสารทั้งหมดใน /share/dms-data [cite: 2.1] (เช่น ใช้ HBS 3 ของ QNAP หรือสคริปต์สำรองข้อมูล) อย่างน้อยวันละ 1 ครั้ง
- ต้องมีแผนการกู้คืนระบบ (Disaster Recovery Plan) ในกรณีที่ Server หลัก (QNAP) ใช้งานไม่ได้
- ขั้นตอนการกู้คืน:
  - **Database Restoration Procedure:**
    - สร้างจาก full backup ล่าสุด
    - Apply transaction logs ถึง point-in-time ที่ต้องการ
    - Verify data integrity post-restoration
  - **File Storage Restoration Procedure:**
    - Restore จาก QNAP snapshot หรือ backup
    - Verify file integrity และ permissions
  - **Application Redeployment Procedure:**
    - Deploy จาก version ล่าสุดที่รู้ว่าทำงานได้
    - Verify application health
  - **Data Integrity Verification Post-Recovery:**
    - Run data consistency checks
    - Verify critical business data
  - **Recovery Time Objective (RTO):** < 4 ชั่วโมง
  - **Recovery Point Objective (RPO):** < 1 ชั่วโมง

## 6.8. กลยุทธ์การแจ้งเตือน (Notification Strategy - ปรับปรุง)

- ระบบจะส่งการแจ้งเตือน (ผ่าน Email หรือ Line [cite: 2.7]) เมื่อมีการกระทำที่สำคัญ\*\* ดังนี้:
  1. เมื่อมีเอกสารใหม่ (Correspondence, RFA) ถูกส่งมาถึงองค์กรณ์ของเรา
  2. เมื่อมีใบเวียน (Circulation) ใหม่ มอบหมายงานมาที่เรา
  3. (ทางเลือก) เมื่อเอกสารที่เราส่งไป ถูกดำเนินการ (เช่น อนุมัติ/ปฏิเสธ)
  4. (ทางเลือก) เมื่อใกล้ถึงวันครบกำหนด (Deadline) [cite: 3.2.5, 3.6.6, 3.7.5]
- Grouping/Digest
  - กรณีมีการแจ้งเตือนประเภทเดียวกันจำนวนมากในช่วงเวลาสั้นๆ (เช่น Approve เอกสาร 10 ฉบับรวด) ระบบต้อง **รวม (Batch)** เป็น 1 Email/Line Notification เพื่อไม่ให้รบกวนผู้ใช้ (Spamming)
- Notification Delivery Guarantees
  - **At-least-once delivery:** สำหรับ important notifications
  - **Retry mechanism:** ด้วย exponential backoff (max 3 reties)
  - **Dead letter queue:** สำหรับ notifications ที่ส่งไม่สำเร็จหลังจาก retries
  - **Delivery status tracking:** ต้องบันทึกสถานะการส่ง notifications
  - **Fallback channels:** ถ้า Email ล้มเหลว ให้ส่งผ่าน SYSTEM notification
  - **Notification preferences:** ผู้ใช้ต้องสามารถกำหนด channel preferences ได้

## 6.9. Maintenance Mode

- ระบบต้องมีกลไก **Maintenance Mode** ที่ Admin สามารถเปิดใช้งานได้
  - เมื่อเปิด: ผู้ใช้ทั่วไปจะเห็นหน้า "ปิดปรับปรุง" และไม่สามารถเรียก API ได้ (ยกเว้น Admin)
  - ใช้สำหรับช่วง Deploy Version ใหม่ หรือ Database Migration

## 6.10. Monitoring และ Observability

- Application Monitoring
  - **Health checks:** /health endpoint สำหรับ load balancer
  - **Metrics collection:** Response times, error rates, throughput
  - **Distributed tracing:** สำหรับ request tracing across services
  - **Log aggregation:** Structured logging ด้วย JSON format
  - **Alerting:** สำหรับ critical errors และ performance degradation
- Business Metrics
  - จำนวน documents created ต่อวัน
  - Workflow completion rates
  - User activity metrics
  - System utilization rates
  - Search query performance
- Security Monitoring
  - Failed login attempts
  - Rate limiting triggers
  - Virus scan results
  - File download activities
  - Permission changes

## 6.11. JSON Processing & Validation

- JSON Schema Management
  - ต้องมี centralized JSON schema registry
  - ต้องรองรับ schema versioning และ migration
  - ต้องมี schema validation during runtime
- Performance Optimization
  - **Caching:** Cache parsed JSON structures
  - **Compression:** ใช้ compression สำหรับ JSON ขนาดใหญ่
  - **Indexing:** Support JSON path indexing สำหรับ query
- Error Handling
  - ต้องมี graceful degradation เมื่อ JSON validation ล้มเหลว
  - ต้องมี default fallback values
  - ต้องบันทึก error logs สำหรับ validation failures
