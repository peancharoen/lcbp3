# 📊 KPI Baseline Data & Measurement Plan — LCBP3-DMS v1.8.0

---

title: 'KPI Baseline Data, Measurement Methodology, and Success Tracking'
version: 1.0.0
status: DRAFT — Baseline Collection Pending
owner: Nattanin Peancharoen (Product Owner)
last_updated: 2026-03-11
related:

- specs/00-Overview/00-03-product-vision.md
- specs/00-Overview/README.md
- specs/01-Requirements/01-05-acceptance-criteria.md
- specs/00-Overview/00-04-stakeholder-signoff-and-risk.md

---

> [!IMPORTANT]
> **ต้องเก็บข้อมูล Baseline (As-Is State) ก่อน Go-Live อย่างน้อย T-2 สัปดาห์**  
> ข้อมูล Baseline คือ "ตัวเลขก่อนระบบ" — ใช้เปรียบเทียบหลัง Go-Live เพื่อพิสูจน์ Value ของระบบ

---

## 1. 🎯 KPI Framework Overview

```
Business Goal → Success Metric → KPI → Baseline → Target → Measurement Method
```

### Category ของ KPIs

| Category                | วัดอะไร                        | Primary Audience |
| ----------------------- | ------------------------------ | ---------------- |
| **Efficiency**          | ลดเวลาและลดงานซ้ำซ้อน          | PM, ผู้บริหาร    |
| **Data Quality**        | ความถูกต้องและสมบูรณ์ของข้อมูล | Document Control |
| **Adoption**            | การใช้งานระบบจริง              | PO, IT           |
| **System Performance**  | ความเสถียรและความเร็ว          | Dev, IT          |
| **User Satisfaction**   | ความพึงพอใจของผู้ใช้           | PO, Management   |
| **Security/Compliance** | ความปลอดภัยและการตรวจสอบ       | กทท., Auditor    |

---

## 2. 📋 KPI Register พร้อม Baseline

### KPI-EFF-001: RFA Cycle Time (วัฏจักรอนุมัติ)

**Category:** Efficiency | **Priority:** 🔴 Critical

| Attribute               | Value                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **คำอธิบาย**            | เวลาเฉลี่ยตั้งแต่ Contractor ส่ง RFA จนถึงได้รับคำตอบสุดท้าย                                                     |
| **หน่วย**               | วัน (Calendar Days)                                                                                              |
| **Baseline (As-Is)**    | 📋 **รอเก็บข้อมูล** — ประมาณ 14–21 วัน (จาก Email เดิม)                                                          |
| **Target (Month 1)**    | ≤ 7 วัน                                                                                                          |
| **Target (Month 3)**    | ≤ 5 วัน                                                                                                          |
| **Target (Month 6)**    | ≤ 3 วัน                                                                                                          |
| **วิธีเก็บ Baseline**   | Analyze Email Thread: วัน Submit Email → วัน Reply สุดท้าย (30 RFAs ล่าสุด)                                      |
| **วิธีวัดหลัง Go-Live** | `SELECT AVG(DATEDIFF(closed_date, submitted_date)) FROM workflow_instances WHERE type='RFA' AND status='CLOSED'` |
| **Frequency**           | Monthly Report                                                                                                   |
| **Owner**               | PO + สค. (Data Collection)                                                                                       |

**ข้อมูล Baseline ที่ต้องเก็บ:**

```
แบบฟอร์ม Baseline RFA:
- เลขที่ RFA (เดิม):
- วันที่ส่ง (Email):
- วันที่ได้รับคำตอบ:
- ระยะเวลา (วัน):
- ผลลัพธ์: Approved / AW Comments / Rejected
- องค์กรที่ส่ง:
- Discipline:
```

---

### KPI-EFF-002: Document Number Error Rate

**Category:** Efficiency + Data Quality | **Priority:** 🔴 Critical

| Attribute               | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| **คำอธิบาย**            | % ของเลขเอกสารที่ผิดพลาด (ซ้ำ, ผิด Format, ต้องยกเลิกและออกใหม่)         |
| **หน่วย**               | % จากเอกสารทั้งหมดที่ออกในเดือนนั้น                                      |
| **Baseline (As-Is)**    | 📋 **รอเก็บข้อมูล** — ประมาณ 5–15% (จากการนับมือ)                        |
| **Target**              | 0% (Zero Tolerance — ระบบ Auto-Number)                                   |
| **วิธีเก็บ Baseline**   | สัมภาษณ์ Document Control แต่ละองค์กร + นับจากเอกสาร 3 เดือนล่าสุด       |
| **วิธีวัดหลัง Go-Live** | Count `document_number_reservations.status = 'CANCELLED'` / Total Issued |
| **Frequency**           | Monthly                                                                  |
| **Owner**               | Document Control (Baseline) + System (Auto-measure)                      |

---

### KPI-EFF-003: Time to Find Document (ค้นหาเอกสาร)

**Category:** Efficiency | **Priority:** 🟠 High

| Attribute               | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| **คำอธิบาย**            | เวลาเฉลี่ยที่ใช้ค้นหาเอกสารที่ต้องการ                              |
| **หน่วย**               | นาที                                                               |
| **Baseline (As-Is)**    | 📋 **รอเก็บข้อมูล** — ประมาณ 15–30 นาที (ผ่าน Email/Drive แบบเดิม) |
| **Target**              | < 1 นาที (ผ่าน Elasticsearch)                                      |
| **วิธีเก็บ Baseline**   | User Survey + Observation: จับเวลาค้นหาเอกสาร 5 ครั้ง × 5 User     |
| **วิธีวัดหลัง Go-Live** | Search Response Time จาก Elasticsearch API Metrics + User Survey   |
| **Frequency**           | Quarterly Survey + Continuous System Metric                        |
| **Owner**               | PO                                                                 |

---

### KPI-EFF-004: Manual Follow-up Calls Reduction

**Category:** Efficiency | **Priority:** 🟠 High

| Attribute               | Value                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| **คำอธิบาย**            | จำนวนครั้งที่ต้องโทร/Line เพื่อถามสถานะเอกสารต่อสัปดาห์                   |
| **หน่วย**               | ครั้ง/สัปดาห์ (per Document Control)                                      |
| **Baseline (As-Is)**    | 📋 **รอเก็บข้อมูล** — บันทึก 2 สัปดาห์ก่อน Go-Live                        |
| **Target**              | ลดลง > 80% (Real-time tracking ช่วย)                                      |
| **วิธีเก็บ Baseline**   | Document Control บันทึกจำนวน Follow-up Calls ต่อวัน 2 สัปดาห์ก่อน Go-Live |
| **วิธีวัดหลัง Go-Live** | Survey (Month 1, Month 3): "สัปดาห์ที่ผ่านมาโทรถามสถานะเอกสารกี่ครั้ง?"   |
| **Frequency**           | Monthly Survey                                                            |
| **Owner**               | PO + Document Control                                                     |

---

### KPI-ADOPT-001: User Adoption Rate (Login Rate)

**Category:** Adoption | **Priority:** 🔴 Critical

| Attribute          | Value                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **คำอธิบาย**       | % ของ Active Users ที่ Login เข้าระบบอย่างน้อย 1 ครั้ง/วัน                                                         |
| **หน่วย**          | % จาก Total Active User Accounts                                                                                   |
| **Baseline**       | N/A (ระบบใหม่ — ไม่มี Baseline)                                                                                    |
| **Target Week 1**  | > 50%                                                                                                              |
| **Target Month 1** | > 70%                                                                                                              |
| **Target Month 3** | > 90%                                                                                                              |
| **วิธีวัด**        | `SELECT COUNT(DISTINCT user_id) / total_users FROM audit_logs WHERE action='USER_LOGIN' AND created_at >= today-1` |
| **Dashboard**      | Grafana Panel: "Daily Active Users"                                                                                |
| **Frequency**      | Daily (Hypercare) → Weekly (Month 2+)                                                                              |
| **Owner**          | PO + IT                                                                                                            |

---

### KPI-ADOPT-002: Feature Adoption Rate (Core Workflows)

**Category:** Adoption | **Priority:** 🟠 High

| Attribute          | Value                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **คำอธิบาย**       | % ของ Active Users ที่ใช้ Core Feature จริง (ไม่ใช่แค่ Login)                                         |
| **หน่วย**          | %                                                                                                     |
| **Target Month 1** | > 50% ใช้ Dashboard + Search                                                                          |
| **Target Month 3** | > 80% ใช้ Workflow (Submit/Approve อย่างน้อย 1 ครั้ง)                                                 |
| **วิธีวัด**        | Audit Log Analysis: count unique users ที่มี action = 'DOCUMENT_SUBMITTED' หรือ 'WORKFLOW_TRANSITION' |
| **Frequency**      | Monthly                                                                                               |
| **Owner**          | PO                                                                                                    |

---

### KPI-ADOPT-003: Support Ticket Volume Trend

**Category:** Adoption | **Priority:** 🟠 High

| Attribute          | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| **คำอธิบาย**       | จำนวน Support Tickets ต่อสัปดาห์ (Trend ลดลง = ระบบ Usable มากขึ้น)  |
| **หน่วย**          | Tickets/สัปดาห์                                                      |
| **Baseline**       | N/A                                                                  |
| **Target Week 1**  | < 30 tickets (Hypercare acceptable)                                  |
| **Target Month 1** | < 15 tickets                                                         |
| **Target Month 3** | < 5 tickets                                                          |
| **วิธีวัด**        | LINE Group message count (manual) หรือ Helpdesk ticketing tool ถ้ามี |
| **Frequency**      | Weekly                                                               |
| **Owner**          | NAP Support                                                          |

---

### KPI-PERF-001: API Response Time (P90)

**Category:** System Performance | **Priority:** 🔴 Critical

| Attribute           | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **คำอธิบาย**        | 90th Percentile response time ของ API requests ทั้งหมด                                          |
| **หน่วย**           | Milliseconds                                                                                    |
| **Target**          | < 200ms (P90) ตาม AC-PERF-001                                                                   |
| **Alert Threshold** | > 500ms ต่อเนื่อง 5 นาที → Alert                                                                |
| **Critical**        | > 1000ms ต่อเนื่อง 1 นาที → PagerDuty                                                           |
| **วิธีวัด**         | Prometheus + Grafana: `histogram_quantile(0.9, rate(http_request_duration_seconds_bucket[5m]))` |
| **Frequency**       | Continuous (Real-time dashboard)                                                                |
| **Owner**           | NAP Dev                                                                                         |

---

### KPI-PERF-002: System Uptime

**Category:** System Performance | **Priority:** 🔴 Critical

| Attribute     | Value                                                 |
| ------------- | ----------------------------------------------------- |
| **คำอธิบาย**  | % ของเวลาที่ระบบพร้อมใช้งาน (ในเวลาทำงาน 08:00-18:00) |
| **หน่วย**     | %                                                     |
| **Target**    | ≥ 99.5% (ตาม ADR-015)                                 |
| **คำนวณ**     | ≥ 99.5% = Downtime ≤ 2.16 ชม./เดือน                   |
| **วิธีวัด**   | Uptime Kuma + Prometheus: Health Check Endpoint       |
| **Frequency** | Real-time + Monthly SLA Report                        |
| **Owner**     | NAP Dev + IT                                          |

**Uptime Calculation Template:**

```
เดือน: __________
Total Hours (08:00-18:00, วันทำงาน): ___ ชั่วโมง
Downtime รวม: ___ นาที
Uptime %: ((Total Hours × 60 - Downtime) / (Total Hours × 60)) × 100
```

---

### KPI-PERF-003: File Scan Success Rate

**Category:** Security | **Priority:** 🟠 High

| Attribute     | Value                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| **คำอธิบาย**  | % ของไฟล์อัปโหลดที่ถูก Scan โดย ClamAV สำเร็จ (ไม่ใช่ Skip หรือ Error)               |
| **หน่วย**     | %                                                                                    |
| **Target**    | ≥ 99.9% (ทุกไฟล์ต้อง Scan)                                                           |
| **วิธีวัด**   | Audit Log: COUNT(action='FILE_VIRUS_SCAN_COMPLETED') / COUNT(action='FILE_UPLOADED') |
| **Frequency** | Daily Check                                                                          |
| **Owner**     | NAP Dev                                                                              |

---

### KPI-SAT-001: User Satisfaction Score (CSAT)

**Category:** User Satisfaction | **Priority:** 🟠 High

| Attribute          | Value                                     |
| ------------------ | ----------------------------------------- |
| **คำอธิบาย**       | คะแนนความพึงพอใจโดยรวมของผู้ใช้ระบบ (1–5) |
| **หน่วย**          | คะแนน (1.0–5.0)                           |
| **Baseline**       | N/A                                       |
| **Target Month 1** | ≥ 3.5/5.0 (ยังอยู่ใน Learning Curve)      |
| **Target Month 3** | ≥ 4.0/5.0                                 |
| **Target Month 6** | ≥ 4.3/5.0                                 |
| **วิธีวัด**        | Google Forms Survey (แบบสอบถาม)           |
| **Frequency**      | Month 1, Month 3, Month 6                 |
| **Owner**          | PO                                        |

---

### KPI-SAT-002: System Ease of Use Score (SUS-lite)

**Category:** User Satisfaction | **Priority:** 🟡 Medium

| Attribute          | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| **คำอธิบาย**       | "ระบบนี้ง่ายต่อการใช้งาน" (1=ไม่เห็นด้วยมาก, 5=เห็นด้วยมาก) |
| **หน่วย**          | คะแนน (1.0–5.0)                                             |
| **Target Month 3** | ≥ 4.0/5.0                                                   |
| **วิธีวัด**        | ใน Survey เดียวกับ KPI-SAT-001                              |
| **Frequency**      | Month 1, Month 3                                            |
| **Owner**          | PO                                                          |

---

### KPI-SEC-001: Audit Log Coverage Rate

**Category:** Security/Compliance | **Priority:** 🔴 Critical

| Attribute     | Value                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| **คำอธิบาย**  | % ของ User Actions ที่ถูกบันทึกใน Audit Log                                           |
| **หน่วย**     | %                                                                                     |
| **Target**    | 100% (ทุก Action ต้องบันทึก — AC-AUDIT-001)                                           |
| **วิธีวัด**   | Spot Check: ทำ Action → ตรวจ audit_logs ว่ามี Record หรือไม่ (Manual QA ก่อน Go-Live) |
| **Frequency** | Pre Go-Live Audit + Monthly Spot Check                                                |
| **Owner**     | NAP Dev                                                                               |

---

### KPI-SEC-002: Security Incident Count

**Category:** Security | **Priority:** 🔴 Critical

| Attribute     | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **คำอธิบาย**  | จำนวน Security Incidents ที่ตรวจพบ (Unauthorized access, Virus, etc.) |
| **หน่วย**     | จำนวนครั้ง                                                            |
| **Target**    | 0 (Zero Incidents ในเวลาทำงาน)                                        |
| **Threshold** | > 0 Critical → Immediate escalation                                   |
| **วิธีวัด**   | Security Audit Log Dashboard (Grafana)                                |
| **Frequency** | Daily Check (Hypercare) → Weekly                                      |
| **Owner**     | NAP Dev + IT                                                          |

---

## 3. 📅 Baseline Data Collection Plan

### T-4 สัปดาห์ก่อน Go-Live: เตรียม

- [ ] ออกแบบ Survey Form สำหรับ User Baseline
- [ ] เตรียม Template บันทึกข้อมูล Email-based RFAs
- [ ] นัด Document Control แต่ละองค์กรเพื่อเก็บข้อมูล
- [ ] กำหนด Baseline Period: 3 เดือนย้อนหลัง (ธ.ค. 2568 – ก.พ. 2569)

### T-3 สัปดาห์: เก็บ Baseline ข้อมูล Process

**สิ่งที่ต้องเก็บ:**

```
📋 BASELINE COLLECTION FORMS:

Form A: RFA Cycle Time (KPI-EFF-001)
──────────────────────────────────
สัมภาษณ์กับ Document Control แต่ละ Org
เก็บข้อมูล RFA 30 ฉบับล่าสุด (จากระบบเดิม):

| # | เลข RFA เดิม | วันที่ส่ง | วันที่ตอบ | ระยะเวลา (วัน) | ผลลัพธ์ |
|---|-------------|----------|----------|--------------|--------|
| 1 |             |          |          |              |        |
...
Average: ___ วัน | Min: ___ | Max: ___

Form B: Document Number Error (KPI-EFF-002)
───────────────────────────────────────────
จากเอกสาร 3 เดือนล่าสุด:
- เอกสารที่ออกทั้งหมด: ___ ฉบับ
- เลขที่ผิดพลาด/ซ้ำ ต้องยกเลิก: ___ ฉบับ
- Error Rate: ___%

Form C: Follow-up Calls (KPI-EFF-004)
────────────────────────────────────
Document Control บันทึกเป็นเวลา 2 สัปดาห์:
วันที่ | จำนวนครั้งที่โทรถามสถานะ
...

Form D: Time to Find Document (KPI-EFF-003)
───────────────────────────────────────────
สังเกตการณ์ 5 User × 5 ครั้ง:
"ค้นหา [เอกสารที่ระบุ] ใช้เวลากี่นาที?"
| User | ครั้งที่ 1 | 2 | 3 | 4 | 5 | เฉลี่ย |
...
```

### T-2 สัปดาห์: เก็บ Baseline ข้อมูล User Perception

```
📋 PRE-GO-LIVE USER SURVEY (Google Form)

Section 1: ปัญหาปัจจุบัน (ก่อนระบบใหม่)
1. "ระบบปัจจุบัน (Email) ให้คะแนนความสะดวก" (1–5): ___
2. "ฉันใช้เวลาค้นหาเอกสารเฉลี่ยครั้งละ" (นาที): ___
3. "ข้อปัญหาหลักสูงสุด 3 อันดับ" (checkbox)
4. "ฉันต้องโทรถามสถานะเอกสารสัปดาห์ละ" (ครั้ง): ___

Section 2: ความคาดหวังจากระบบใหม่
5. "สิ่งที่คาดหวังมากที่สุดจากระบบใหม่": (text)
6. "ความกังวลเกี่ยวกับการเปลี่ยนระบบ": (text)
```

---

## 4. 📊 KPI Dashboard Template

### Monthly KPI Report Template

```markdown
# Monthly KPI Report — LCBP3-DMS

Period: [เดือน ปี] | Generated: [วันที่]

## 🟢 On Track / 🟡 Watch / 🔴 Off Track

| KPI              | Baseline   | Target  | Actual     | Status   | Delta   |
| ---------------- | ---------- | ------- | ---------- | -------- | ------- |
| RFA Cycle Time   | \_\_\_ วัน | ≤ 5 วัน | \_\_\_ วัน | 🟢/🟡/🔴 | \_\_\_% |
| Doc Number Error | \_\_\_%    | 0%      | \_\_\_%    | 🟢/🟡/🔴 | \_\_\_% |
| User Adoption    | N/A        | ≥ 70%   | \_\_\_%    | 🟢/🟡/🔴 | \_\_\_% |
| API P90          | N/A        | < 200ms | \_\_\_ms   | 🟢/🟡/🔴 | \_\_\_% |
| Uptime           | N/A        | ≥ 99.5% | \_\_\_%    | 🟢/🟡/🔴 | \_\_\_% |
| CSAT Score       | N/A        | ≥ 4.0   | \_\_\_     | 🟢/🟡/🔴 | \_\_\_% |

## 🔍 Highlights

[Key findings this month]

## ⚠️ Issues & Actions

| Issue | Impact | Action | Owner | Deadline |
...

## 📈 Trend Charts

[Link to Grafana Dashboard]
```

---

## 5. 📈 Target vs. Baseline Summary Table

| KPI ID        | ชื่อ KPI           | หน่วย         | Baseline   | Target M1 | Target M3 | Target M6 |
| ------------- | ------------------ | ------------- | ---------- | --------- | --------- | --------- |
| KPI-EFF-001   | RFA Cycle Time     | วัน           | ~14-21     | ≤ 7       | ≤ 5       | ≤ 3       |
| KPI-EFF-002   | Doc Number Error   | %             | ~5-15%     | < 1%      | 0%        | 0%        |
| KPI-EFF-003   | Time to Find Doc   | นาที          | ~15-30     | < 3       | < 1       | < 1       |
| KPI-EFF-004   | Follow-up Calls    | ครั้ง/สัปดาห์ | ~10-20     | < 10      | < 5       | < 2       |
| KPI-ADOPT-001 | User Adoption      | %             | N/A        | > 50%     | > 70%     | > 90%     |
| KPI-ADOPT-002 | Feature Adoption   | %             | N/A        | > 30%     | > 60%     | > 80%     |
| KPI-ADOPT-003 | Support Tickets    | ครั้ง/สัปดาห์ | N/A        | < 30      | < 15      | < 5       |
| KPI-PERF-001  | API Response P90   | ms            | N/A        | < 200     | < 200     | < 200     |
| KPI-PERF-002  | System Uptime      | %             | N/A        | ≥ 99.5%   | ≥ 99.5%   | ≥ 99.9%   |
| KPI-PERF-003  | File Scan Success  | %             | N/A        | 100%      | 100%      | 100%      |
| KPI-SAT-001   | CSAT Score         | /5.0          | Survey Pre | ≥ 3.5     | ≥ 4.0     | ≥ 4.3     |
| KPI-SAT-002   | Ease of Use        | /5.0          | Survey Pre | ≥ 3.5     | ≥ 4.0     | ≥ 4.2     |
| KPI-SEC-001   | Audit Coverage     | %             | N/A        | 100%      | 100%      | 100%      |
| KPI-SEC-002   | Security Incidents | ครั้ง         | N/A        | 0         | 0         | 0         |

---

## 6. 🔧 Technical Measurement Implementation

### Grafana Dashboard Panels (ต้องสร้างก่อน Go-Live)

```yaml
# Prometheus Metrics to Collect:
panels:
  - title: 'RFA Cycle Time (Avg)'
    query: |
      avg(
        timestamp(workflow_closed_at) - timestamp(workflow_submitted_at)
      ) by (month) WHERE type = 'rfa'
    unit: days

  - title: 'Daily Active Users'
    query: |
      count(distinct user_id) FROM audit_logs 
      WHERE action = 'USER_LOGIN' AND date = today

  - title: 'API P90 Response Time'
    query: |
      histogram_quantile(0.90,
        rate(http_request_duration_seconds_bucket[5m])
      )
    unit: ms
    alert_threshold: 500

  - title: 'System Uptime (30d)'
    query: avg_over_time(up[30d]) * 100
    unit: percent

  - title: 'File Virus Scan Queue'
    query: bullmq_queue_size{queue="virus-scan"}

  - title: 'Support Tickets This Week'
    query: custom_metric (manual input)
```

### SQL Queries for Business KPIs

```sql
-- KPI-EFF-001: RFA Cycle Time (ต่อเดือน)
SELECT
    DATE_FORMAT(wi.submitted_at, '%Y-%m') AS month,
    COUNT(*) AS total_rfas,
    AVG(DATEDIFF(wi.closed_at, wi.submitted_at)) AS avg_days,
    MIN(DATEDIFF(wi.closed_at, wi.submitted_at)) AS min_days,
    MAX(DATEDIFF(wi.closed_at, wi.submitted_at)) AS max_days,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY DATEDIFF(wi.closed_at, wi.submitted_at)) AS median_days
FROM workflow_instances wi
WHERE wi.document_type = 'RFA'
    AND wi.status = 'CLOSED'
    AND wi.closed_at IS NOT NULL
GROUP BY DATE_FORMAT(wi.submitted_at, '%Y-%m')
ORDER BY month DESC;

-- KPI-ADOPT-001: Daily Active Users
SELECT
    DATE(created_at) AS date,
    COUNT(DISTINCT user_id) AS daily_active_users,
    (SELECT COUNT(*) FROM users WHERE is_active = 1) AS total_active_users,
    ROUND(COUNT(DISTINCT user_id) * 100.0 /
          (SELECT COUNT(*) FROM users WHERE is_active = 1), 1) AS adoption_rate
FROM audit_logs
WHERE action = 'USER_LOGIN'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- KPI-EFF-002: Document Number Error Rate
SELECT
    DATE_FORMAT(created_at, '%Y-%m') AS month,
    COUNT(*) AS total_reserved,
    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
    ROUND(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS error_rate_pct
FROM document_number_reservations
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
GROUP BY DATE_FORMAT(created_at, '%Y-%m');
```

---

## 7. 📋 User Survey Templates

### Post Go-Live Survey (Month 1 & Month 3)

```
📝 LCBP3-DMS User Satisfaction Survey
Period: [เดือน] | ใช้เวลา: ประมาณ 3 นาที

Section 1: ภาพรวม
━━━━━━━━━━━━━━━
Q1. โดยรวม ระบบ LCBP3-DMS ช่วยให้การทำงานของคุณดีขึ้น?
    ⬜ 1-ไม่เลย  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5-ดีขึ้นมาก

Q2. ระบบนี้ง่ายต่อการใช้งานมากแค่ไหน?
    ⬜ 1-ยากมาก  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5-ง่ายมาก

Section 2: Feature Specific
━━━━━━━━━━━━━━━━━━━━━━━━
Q3. Feature ที่คุณใช้บ่อยที่สุด: (checkbox, เลือกได้หลายข้อ)
    ⬜ Dashboard  ⬜ สร้าง Correspondence  ⬜ Review RFA
    ⬜ ค้นหาเอกสาร  ⬜ Circulation  ⬜ ดู Workflow

Q4. Feature ที่ยังมีปัญหาหรืออยากให้ปรับปรุง: (text)
    _______________________________________________

Section 3: เปรียบเทียบกับระบบเดิม
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q5. เวลาค้นหาเอกสาร เปรียบกับระบบเดิม:
    ⬜ เร็วกว่ามาก  ⬜ เร็วกว่านิดหน่อย  ⬜ เหมือนเดิม  ⬜ ช้ากว่า

Q6. จำนวนครั้งที่ต้องโทรถามสถานะ เปรียบกับเดิม:
    ⬜ น้อยกว่ามาก  ⬜ น้อยกว่า  ⬜ เหมือนเดิม  ⬜ มากกว่า

Section 4: Open Feedback
━━━━━━━━━━━━━━━━━━━━
Q7. สิ่งที่คุณชอบมากที่สุดในระบบนี้: _______________
Q8. สิ่งที่คุณอยากให้ปรับปรุงเร่งด่วนที่สุด: ___________
Q9. คะแนนรวม (NPS): 0-10 — "คุณจะแนะนำระบบนี้ให้เพื่อนร่วมงาน?"
    0──────────────────10
    [0-6: Detractor] [7-8: Passive] [9-10: Promoter]
```

---

## 8. 📊 KPI Review Meeting Agenda Template

```markdown
# LCBP3-DMS Monthly KPI Review — [เดือน ปี]

วันที่: | เวลา: 30 นาที | ผู้เข้าร่วม: PO, IT, Document Control Lead

## Agenda

1. KPI Dashboard Review (10 นาที)
   - Performance KPIs: Uptime, API Response
   - Efficiency KPIs: RFA Cycle Time, Error Rate
   - Adoption KPIs: DAU, Feature Adoption
2. Status Discussion (10 นาที)
   - 🔴 Off Track KPIs: root cause + action plan
   - 🟡 Watch KPIs: monitoring plan
3. User Feedback Summary (5 นาที)
   - Key themes from support tickets
   - Survey results (if applicable)
4. Actions for Next Month (5 นาที)
   - [Action] | [Owner] | [Deadline]

## Notes / Decisions
```

---

## 📝 Document Control

- **Version:** 1.0.0 | **Status:** DRAFT — Baseline Collection Pending
- **Created:** 2026-03-11 | **Owner:** Nattanin Peancharoen
- **Baseline Collection Deadline:** T-2 สัปดาห์ก่อน Go-Live
- **First KPI Review:** T+1 เดือนหลัง Go-Live
- **Classification:** Internal Use Only
