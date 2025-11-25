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

## ตาราง correspondence_sub_types

| id  | correspondence_types.type_code | sub_type_code | sub_type_name  | sub_type_number |
| --- | ------------------------------ | ------------- | -------------- | --------------- |
| 1   | RFA      | MAT      | Material Approval              | 11     |
| 2   | RFA      | SHP      | Shop Drawing Submittal         | 12     |
| 3   | RFA      | DWG      | Document Approval              | 13     |
| 4   | RFA      | MET      | Engineering Document Submittal | 14     |
| 5   | RFA      | MAT      | Material Approval              | 21     |
| 6   | RFA      | SHP      | Shop Drawing Submittal         | 22     |
| 7   | RFA      | DWG      | Document Approval              | 23     |
| 8   | RFA      | MET      | Engineering Document Submittal | 24     |
| 9   | RFA      | MAT      | Material Approval              | 31     |
| 10  | RFA      | SHP      | Shop Drawing Submittal         | 32     |
| 11  | RFA      | DWG      | Document Approval              | 33     |
| 12  | RFA      | MET      | Engineering Document Submittal | 34     |
| 13  | RFA      | MAT      | Material Approval              | 41     |
| 14  | RFA      | SHP      | Shop Drawing Submittal         | 42     |
| 15  | RFA      | DWG      | Document Approval              | 43     |
| 16  | RFA      | MET      | Engineering Document Submittal | 44     |

## ตาราง disciplines

| contract_code | code | code_name_th                          | code_name_en                               |
|---------------|------|---------------------------------------|--------------------------------------------|
| LCBP3-C1      | GEN  | งานบริหารโครงการ                     | General Management                         |
| LCBP3-C1      | COD  | สัญญาและข้อโต้แย้ง                   | Contracting                                |
| LCBP3-C1      | QSB  | สำรวจปริมาณและควบคุมงบประมาณ        | Quantity Survey and Budget Control         |
| LCBP3-C1      | PPG  | บริหารแผนและความก้าวหน้า            | Plan and Progress Management               |
| LCBP3-C1      | PRC  | งานจัดซื้อ                            | Procurement                                |
| LCBP3-C1      | SUB  | ผู้รับเหมาช่วง                        | Subcontractor                              |
| LCBP3-C1      | ODC  | สำนักงาน-ควบคุมเอกสาร               | Operation Docment Control                  |
| LCBP3-C1      | LAW  | กฎหมาย                               | Law                                        |
| LCBP3-C1      | TRF  | จราจร                                | Traffic                                    |
| LCBP3-C1      | BIM  | BIM                                   | Building information modeling              |
| LCBP3-C1      | SRV  | งานสำรวจ                             | Survey                                     |
| LCBP3-C1      | SFT  | ความปลอดภัย                          | Safety                                     |
| LCBP3-C1      | BST  | งานโครงสร้างอาคาร                   | Building Structure Work                    |
| LCBP3-C1      | TEM  | งานชั่วคราว                          | Temporary Work                             |
| LCBP3-C1      | UTL  | งานระบบสาธารณูปโภค                  | Utility                                    |
| LCBP3-C1      | EPW  | งานระบบไฟฟ้า                         | Electrical Power Work                      |
| LCBP3-C1      | ECM  | งานระบบไฟฟ้าสื่อสาร                  | Electrical Communication Work              |
| LCBP3-C1      | ENV  | สิ่งแวดล้อม                          | Environment                                |
| LCBP3-C1      | AQV  | คุณภาพอากาศและความสั่นสะเทือน       | Air quality and vibration                  |
| LCBP3-C1      | WAB  | คุณภาพน้ำและชีววิทยาทางน้ำ           | Water quality and Aquatic biology          |
| LCBP3-C1      | ONS  | วิศวกรรมชายฝั่ง                      | Onshore Engineer Work                      |
| LCBP3-C1      | PPR  | มวลชนสัมพันธ์และการประชาสัมพันธ์    | Public Relations                           |
| LCBP3-C1      | OSW  | งานก่อสร้างงานทางทะเล               | Offshore Work                              |
| LCBP3-C1      | DRE  | งานขุดและถมทะเล                      | Dredging and Reclamation                   |
| LCBP3-C1      | REV  | งานคันหินล้อมพื้นที่ถมทะเล           | Revetment                                  |
| LCBP3-C1      | BRW  | งานเขื่อนกันคลื่น                    | Breakwater                                 |
| LCBP3-C1      | SOI  | ปรับปรุงคุณภาพดิน                   | Soil Improvement                           |
| LCBP3-C1      | BLC  | งานปรับปรุงคลองบางละมุง             | Bang Lamung Canal Bank Protection          |
| LCBP3-C1      | FUP  | งานประตูระบายน้ำและท่อลอด           | Floodgate & Under Ground Piping Works      |
| LCBP3-C1      | SWP  | งานอาคารควบคุมสถานีสูบน้ำทะเล       | Sea Water Pumping Station Control BuilDing |
| LCBP3-C1      | NAV  | งานติดตั้งเครื่องหมายช่วงการเดินเรือ | Navigations Aids                           |
| LCBP3-C1      | GEO  | งานด้านธรณีเทคนิค                   | Geotechnical                               |
| LCBP3-C1      | CRW  | งานด้านโยธา - Rock Works             | Civil-Rock work                            |
| LCBP3-C1      | DVR  | ทีมนักประดาน้ำ                      | Dive Work                                  |
| LCBP3-C1      | MTS  | งานทดสอบวัสดุและธรณีเทคนิค          | Materials and Geotechnical Testing         |
| LCBP3-C1      | OTH  | อื่นๆ                                | Other                                      |
| LCBP3-C2      | GEN  | งานบริหารโครงการ                     | Project Management                         |
| LCBP3-C2      | COD  | สัญญาและข้อโต้แย้ง                   | Contracts and arguments                    |
| LCBP3-C2      | QSB  | สำรวจปริมาณและควบคุมงบประมาณ        | Survey the quantity and control the budget |
| LCBP3-C2      | PPM  | บริหารแผนและความก้าวหน้า            | Plan Management & Progress                 |
| LCBP3-C2      | ODC  | สำนักงาน-ควบคุมเอกสาร               | Document Control Office                    |
| LCBP3-C2      | LAW  | กฎหมาย                               | Law                                        |
| LCBP3-C2      | TRF  | จราจร                                | Traffic                                    |
| LCBP3-C2      | BIM  | Building Information Modeling         | Building Information Modeling              |
| LCBP3-C2      | SRV  | งานสำรวจ                             | Survey                                     |
| LCBP3-C2      | SFT  | ความปลอดภัย                          | Safety                                     |
| LCBP3-C2      | BST  | งานโครงสร้างอาคาร                   | Building Structure                         |
| LCBP3-C2      | UTL  | งานะบบสาธารณูปโภค                   | Public Utilities                           |
| LCBP3-C2      | EPW  | งานระบบไฟฟ้า                         | Electrical Systems                         |
| LCBP3-C2      | ECM  | งานระบบไฟฟ้าสื่อสาร                  | Electrical Communication System            |
| LCBP3-C2      | ENV  | สิ่งแวดล้อม                          | Environment                                |
| LCBP3-C2      | AQV  | คุณภาพอากาศและความสั่นสะเทือน       | Air Quality and Vibration                  |
| LCBP3-C2      | WAB  | คุณภาพน้ำและชีววิทยาทางน้ำ           | Water Quality and Aquatic Biology          |
| LCBP3-C2      | ONS  | วิศวกรรมชายฝั่ง                      | Coastal Engineering                        |
| LCBP3-C2      | PPR  | มวลชนสัมพันธ์และประชาสัมพันธ์       | Mass Relations and Public Relations        |
| LCBP3-C2      | OFW  | งานก่อสร้างทางทะเล                   | Marine Construction                        |
| LCBP3-C2      | EXR  | งานขุดและถมทะเล                      | Excavation and reclamation                 |
| LCBP3-C2      | GEO  | งานด้านธรณีเทคนิค                   | Geotechnical work                          |
| LCBP3-C2      | CRW  | งานด้านโยธา - Rock Works             | Civil Works - Rock Works                   |
| LCBP3-C2      | DVW  | ทีมนักประดาน้ำ                      | Team of Divers                             |
| LCBP3-C2      | MTT  | งานทดสอบวัสดุ                       | Materials Testing                          |
| LCBP3-C2      | ARC  | งานสถาปัตยกรรม                      | Architecture                               |
| LCBP3-C2      | STR  | งานโครงสร้าง                        | Structural work                            |
| LCBP3-C2      | SAN  | งานระบบสุขาภิบาล                    | Sanitation System                          |
| LCBP3-C2      | DRA  | งานระบบระบายน้ำ                     | Drainage system work                       |
| LCBP3-C2      | TER  | งานท่าเทียบเรือ                     | Wharf work                                 |
| LCBP3-C2      | BUD  | งานอาคาร                            | Building                                   |
| LCBP3-C2      | ROW  | งานถนนและสะพาน                      | Road and Bridge Work                       |
| LCBP3-C2      | MEC  | งานเคริองกล                         | Mechanical work                            |
| LCBP3-C2      | OTH  | อื่น ๆ                               | Others                                     |

## ตาราง doccument_types

| contract_code | code | name_en                                      | name_th                                      |
|---------------|------|----------------------------------------------|----------------------------------------------|
| LCBP3-C1      | ADW  | As Built Drawing                             | แบบร่างหลังการก่อสร้าง                      |
| LCBP3-C1      | BC   | Box culvert                                  | ท่อระบายน้ํารูปกล่อง                         |
| LCBP3-C1      | BM   | Benchmark                                    | หมุดหลักฐาน                                  |
| LCBP3-C1      | CER  | Certificates                                 | ใบรับรอง                                     |
| LCBP3-C1      | CN   | Canal Drainage                               | ระบบระบายน้ําในคลอง                          |
| LCBP3-C1      | CON  | Contract                                     | สัญญา                                        |
| LCBP3-C1      | DDS  | Design Data Submission                      | นำส่งข้อมูลการออกแบบ                         |
| LCBP3-C1      | DDW  | Draft Drawing                                | แบบร่าง                                      |
| LCBP3-C1      | DRW  | Drawings (All Types)                         | แบบก่อสร้าง                                  |
| LCBP3-C1      | DSN  | Design/Calculation/Manual (All Stages)       | ออกแบบ / คำนวณ / คู่มือ                      |
| LCBP3-C1      | GEN  | General                                      | ทั่วไป                                       |
| LCBP3-C1      | ICR  | Incident Report                              | รายงานการเกิดอุบัติเหตุและการบาดเจ็บ       |
| LCBP3-C1      | INS  | Insurances/Bond/Guarantee                    | การประกัน / พันธบัตร / การค้ำประกัน         |
| LCBP3-C1      | INS  | Inspection/Audit/Surveillance Report         | รายงานการตรวจสอบ / การตรวจสอบ / รายงานการเฝ้าระวัง |
| LCBP3-C1      | ITP  | Inspection and Test Plan                     | แผนการตรวจสอบและทดสอบ                       |
| LCBP3-C1      | JSA  | Jobs Alalysis                                | รายงานการวิเคราะห์ความปลอดภัย              |
| LCBP3-C1      | MAN  | Manual                                       | คู่มือ                                       |
| LCBP3-C1      | MAT  | Materials/Equipment/Plant                    | วัสดุ / อุปกรณ์ / โรงงาน                     |
| LCBP3-C1      | MOM  | Minute of Meeting                            | รายงานการประชุม                              |
| LCBP3-C1      | MPR  | Monthly Progress Report                      | รายงานความคืบหน้าประจำเดือน                 |
| LCBP3-C1      | MST  | Method Statement for Construction/Installation| ขั้นตอนการก่อสร้าง / ติดตั้ง                 |
| LCBP3-C1      | NDS  | Non-Design Data Submission                   | นำส่งข้อมูลที่ไม่เกี่ยวข้องกับการออกแบบ      |
| LCBP3-C1      | PMA  | Payment/Invoice/Retention/Estimate           | การชำระเงิน / ใบแจ้งหนี้ / ประกันผลงาน / ประมาณการ |
| LCBP3-C1      | PRD  | Procedure                                    | ระเบียบปฏิบัติ                               |
| LCBP3-C1      | PRG  | Progress of Construc                         | ความคืบหน้าของการก่อสร้าง / ภาพถ่าย / วิดีโอ |
| LCBP3-C1      | QMS  | Quality Document (Plan//Work Instruction)    | เอกสารด้านคุณภาพ (โรงงาน / ข้อแนะนำในการทำงาน) |
| LCBP3-C1      | RPT  | Report                                       | รายงาน                                       |
| LCBP3-C1      | SAR  | Semi Annual Report                           | รายงานประจำหกเดือน                           |
| LCBP3-C1      | SCH  | Schedule and Program                         | แผนงาน                                       |
| LCBP3-C1      | SDW  | Shop Drawing                                 | แบบขยายรายละเอียด                            |
| LCBP3-C1      | SI   | Soil Investigation                           | การตรวจสอบดิน                                |
| LCBP3-C1      | SPE  | Specification                                | ข้อกำหนด                                     |
| LCBP3-C1      | TNR  | Training report                              | รายงานการฝึกปฏิบัติ                          |
| LCBP3-C1      | UC   | Underground Constructon                      | โครงสร้างใต้ดิน                              |
| LCBP3-C1      | VEN  | Vendor                                       | ผู้ขาย                                       |
| LCBP3-C1      | VRO  | Variation Request/Instruction/Order          | คำขอเปลี่ยนแปลง / ข้อเสนอแนะ / ข้อเรียกร้อง |
| LCBP3-C1      | WTY  | Warranty                                     | การประกัน                                    |
| LCBP3-C2      | GEN  | General                                      | ทั่วไป                                       |
| LCBP3-C2      | CON  | Contract                                     | สัญญา                                        |
| LCBP3-C2      | INS  | Insurances/Bond/Guarantee                    | การประกัน / พันธบัตร / การค้ำประกัน         |
| LCBP3-C2      | SCH  | Schedule and Program                         | แผนงาน                                       |
| LCBP3-C2      | PMA  | Payment/Invoice/Retention/Estimate           | การชำระเงิน / ใบแจ้งหนี้ / ประกันผลงาน / ประมาณการ |
| LCBP3-C2      | VRO  | Variation Request/Instruction/Order          | คำขอเปลี่ยนแปลง / ข้อเสนอแนะ / ข้อเรียกร้อง |
| LCBP3-C2      | VEN  | Vendor                                       | ผู้ขาย                                       |
| LCBP3-C2      | WTY  | Warranty                                     | การประกัน                                    |
| LCBP3-C2      | DRW  | Drawings (All Types)                         | แบบก่อสร้าง                                  |
| LCBP3-C2      | DDW  | Draft Drawing                                | แบบร่าง                                      |
| LCBP3-C2      | SDW  | Shop Drawing                                 | แบบขยายรายละเอียด                            |
| LCBP3-C2      | ADW  | As Built Drawing                             | แบบร่างหลังการก่อสร้าง                      |
| LCBP3-C2      | DDS  | Design Data Submission                      | นำส่งข้อมูลการออกแบบ                         |
| LCBP3-C2      | DSN  | Design/Calculation/Manual (All Stages)       | ออกแบบ / คำนวณ / คู่มือ                      |
| LCBP3-C2      | NDS  | Non-Design Data Submission                   | นำส่งข้อมูลที่ไม่เกี่ยวข้องกับการออกแบบ      |
| LCBP3-C2      | PRD  | Procedure                                    | ระเบียบปฏิบัติ                               |
| LCBP3-C2      | MST  | Method Statement for Construction/Installation| ขั้นตอนการก่อสร้าง / ติดตั้ง                 |
| LCBP3-C2      | QMS  | Quality Document (Plan//Work Instruction)    | เอกสารด้านคุณภาพ (โรงงาน / ข้อแนะนำในการทำงาน) |
| LCBP3-C2      | INS  | Inspection/Audit/Surveillance Report         | รายงานการตรวจสอบ / การตรวจสอบ / รายงานการเฝ้าระวัง |
| LCBP3-C2      | ITP  | Inspection and Test Plan                     | แผนการตรวจสอบและทดสอบ                       |
| LCBP3-C2      | MAT  | Materials/Equipment/Plant                    | วัสดุ / อุปกรณ์ / โรงงาน                     |
| LCBP3-C2      | SPE  | Specification                                | ข้อกำหนด                                     |
| LCBP3-C2      | MAN  | Manual                                       | คู่มือ                                       |
| LCBP3-C2      | CER  | Certificates                                 | ใบรับรอง                                     |
| LCBP3-C2      | SAR  | Semi Annual Report                           | รายงานประจำหกเดือน                           |
| LCBP3-C2      | JSA  | Jobs Alalysis                                | รายงานการวิเคราะห์ความปลอดภัย              |
| LCBP3-C2      | MOM  | Minute of Meeting                            | รายงานการประชุม                              |
| LCBP3-C2      | MPR  | Monthly Progress Report                      | รายงานความคืบหน้าประจำเดือน                 |
| LCBP3-C2      | ICR  | Incident Report                              | รายงานการเกิดอุบัติเหตุและการบาดเจ็บ       |
| LCBP3-C2      | PRG  | Progress of Construc                         | ความคืบหน้าของการก่อสร้าง / ภาพถ่าย / วิดีโอ |
| LCBP3-C2      | RPT  | Report                                       | รายงาน                                       |
| LCBP3-C2      | TNR  | Training report

