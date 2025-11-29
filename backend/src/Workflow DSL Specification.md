# **Workflow DSL Specification v1.0**

เอกสารนี้ระบุโครงสร้างภาษา (Domain-Specific Language) สำหรับกำหนด Business Logic ของการเดินเอกสารในระบบ LCBP3-DMS

## **1\. โครงสร้างหลัก (Root Structure)**

ไฟล์ Definition ต้องอยู่ในรูปแบบ YAML หรือ JSON โดยมีโครงสร้างดังนี้:

```json
workflow: "RFA_FLOW" # รหัส Workflow (Unique)
version: 1 # เวอร์ชันของ Logic
description: "RFA Approval Process" # คำอธิบาย

# รายการสถานะทั้งหมดที่เป็นไปได้
states:
- name: "DRAFT" # ชื่อสถานะ (Case-sensitive)
initial: true # เป็นสถานะเริ่มต้น (ต้องมี 1 สถานะ)
on: # รายการ Action ที่ทำได้จากสถานะนี้
SUBMIT: # ชื่อ Action (ปุ่มที่ User กด)
to: "IN_REVIEW" # สถานะปลายทาง
require: # (Optional) เงื่อนไขสิทธิ์
role: "EDITOR"
events: # (Optional) เหตุการณ์ที่จะเกิดขึ้นเมื่อเปลี่ยนสถานะ
- type: "notify"
target: "reviewer"

- name: "IN_REVIEW"
on:
APPROVE:
to: "APPROVED"
condition: "context.amount < 1000000" # (Optional) JS Expression
REJECT:
to: "DRAFT"
events:
- type: "notify"
target: "creator"

- name: "APPROVED"
terminal: true # เป็นสถานะจบ (ไม่สามารถไปต่อได้)
```

## **2. รายละเอียด Field (Field Definitions)**

### **2.1 State Object**

| Field    | Type    | Required | Description                                    |
| :------- | :------ | :------- | :--------------------------------------------- |
| name     | string  | Yes      | ชื่อสถานะ (Unique Key)                         |
| initial  | boolean | No       | ระบุว่าเป็นจุดเริ่มต้น (ต้องมี 1 state ในระบบ) |
| terminal | boolean | No       | ระบุว่าเป็นจุดสิ้นสุด                          |
| on       | object  | No       | Map ของ Action -> Transition Rule              |

### **2.2 Transition Rule Object**

| Field     | Type   | Required | Description                             |
| :-------- | :----- | :------- | :-------------------------------------- |
| to        | string | Yes      | ชื่อสถานะปลายทาง                        |
| require   | object | No       | เงื่อนไข Role/User                      |
| condition | string | No       | JavaScript Expression (return boolean)  |
| events    | array  | No       | Side-effects ที่จะทำงานหลังเปลี่ยนสถานะ |

### **2.3 Requirements Object**

| Field | Type   | Description                                 |
| :---- | :----- | :------------------------------------------ |
| role  | string | User ต้องมี Role นี้ (เช่น PROJECT_MANAGER) |
| user  | string | User ต้องมี ID นี้ (Hard-code)              |

### **2.4 Event Object**

| Field    | Type   | Description                                |
| :------- | :----- | :----------------------------------------- |
| type     | string | notify, webhook, update_status             |
| target   | string | ผู้รับ (เช่น creator, assignee, หรือ Role) |
| template | string | รหัส Template ข้อความ                      |

## **3\. ตัวอย่างการใช้งานจริง (Real-world Examples)**

### **ตัวอย่าง: RFA Approval Flow**

```json
{
  "workflow": "RFA_STD",
  "version": 1,
  "states": [
    {
      "name": "DRAFT",
      "initial": true,
      "on": {
        "SUBMIT": {
          "to": "CONSULTANT_REVIEW",
          "require": { "role": "CONTRACTOR" }
        }
      }
    },
    {
      "name": "CONSULTANT_REVIEW",
      "on": {
        "APPROVE_1": {
          "to": "OWNER_REVIEW",
          "condition": "context.priority === 'HIGH'"
        },
        "APPROVE_2": {
          "to": "APPROVED",
          "condition": "context.priority === 'NORMAL'"
        },
        "REJECT": {
          "to": "DRAFT"
        }
      }
    },
    {
      "name": "OWNER_REVIEW",
      "on": {
        "APPROVE": { "to": "APPROVED" },
        "REJECT": { "to": "CONSULTANT_REVIEW" }
      }
    },
    {
      "name": "APPROVED",
      "terminal": true
    }
  ]
}
```
