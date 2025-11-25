# Special requirements for document-numbering
การใช้งานจริงต้องการความยืดหยุ่นสูง สำหรับ ระบบ document-numbering ดังนี้

## 1. ต้องให้ admin สามารถกำหนดรูปแบบในถายหลังได้
## 2. มีรูปแบบเริ่มต้นดังนี้
* 2.1 สำหรับ correspondence ทั่วไป
  * ใช้รูปแบบ [organizations.organization_code]-[organizations.organization_code]-[sequence]-[year]
  * **_ตัวอย่าง: คคง.-ผรม.2-0123-2568_**
* 2.2 สำหรับ correspondence type = transmittal
  * ใช้รูปแบบ [organizations.organization_code]-[organizations.organization_code]-[codecorrespondence_sub_types.sub_type_number]-[seq]-[year]
  * **_ตัวอย่าง: คคง.-สคฉ.3-22-0123-2568_**
* 2.3 สำหรับ correspondence type = rfi
  * ใช้รูปแบบ [contrcts.contract_code]-[correspondences_types.type_code]-[disciplines_code]-[seq]-[revision]
  * **_ตัวอย่าง: LCBP3-C2-RFI-TER-2345-A_**
* 2.4 สำหรับ rfa ใช้แบบเลขแยกกัน
  * ใช้รูปแบบ [contrcts.contract_code]-[correspondences_types.type_code]-[disciplines_code]-[rfa_types.type_code]-[seq]-[revision]
  * **_ตัวอย่าง: LCBP3-C1-RFA-TER-MAT-1234-A_**

## ตาราง codecorrespondence_sub_types

| id  | correspondence_types.type_code | sub_type_code | sub_type_name | sub_type_number |
| --- | ------------------------------ | ------------- | ------------- | --------------- |
| 1   | RFA                            | RFA           | C1 RFA        | 11              |
| 2   | RFA                            | MAT           | C1 MAT        | 12              |
| 3   | RFA                            | DWG           | C1 DWG        | 13              |
| 4   | RFA                            | 4             | C1 4          | 14              |
| 5   | RFA                            | 5             | C2 1          | 21              |
| 6   | RFA                            | 6             | C2 2          | 22              |
| 7   | RFA                            | 7             | C2 3          | 23              |
| 8   | RFA                            | 8             | C2 4          | 24              |
| 9   | RFA                            | 9             | C3 1          | 31              |
| 10  | RFA                            | 10            | C3 2          | 32              |
| 11  | RFA                            | 11            | C3 3          | 33              |
| 12  | RFA                            | 12            | C3 4          | 34              |
| 13  | RFA                            | 13            | C4 1          | 41              |
| 14  | RFA                            | 14            | C4 2          | 42              |
| 15  | RFA                            | 15            | C4 3          | 43              |
| 16  | RFA                            | 16            | C4 4          | 44              |

## ตาราง discipline_codes

| id  | discipline_code | discipline_name | discipline_number |
| --- | --------------- | --------------- | ----------------- |
| 1   | BUD             | C1 RFA          | 11                |
| 2   | ROW             | C1 MAT          | 12                |
| 3   | TER             | C1 DWG          | 13                |
| 4   | UTL             | C1 4            | 14                |
| 5   | 5               | C2 1            | 21                |
| 6   | 6               | C2 2            | 22                |
| 7   | 7               | C2 3            | 23                |
| 8   | 8               | C2 4            | 24                |
| 9   | 9               | C3 1            | 31                |
| 10  | 10              | C3 2            | 32                |
| 11  | 11              | C3 3            | 33                |
| 12  | 12              | C3 4            | 34                |
| 13  | 13              | C4 1            | 41                |
| 14  | 14              | C4 2            | 42                |
| 15  | 15              | C4 3            | 43                |
| 16  | 16              | C4 4            | 44                |
