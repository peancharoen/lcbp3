"""
ทดสอบ typhoon2.5-np-dms โดยใช้ prompt template จริง + OCR text จาก test.md + master data context จาก DB
รันด้วย: python test_llm.py
"""

import json
import time
import urllib.request
import urllib.error
from pathlib import Path

OLLAMA_URL = "http://192.168.10.100:11434"
MODEL = "typhoon2.5-np-dms:latest"
OCR_TEXT_FILE = Path(__file__).parent / "test.md"

# --- Prompt Template (ดึงจาก DB: ai_prompts version=2, prompt_type=ocr_extraction) ---
TEMPLATE = """คุณคือเอนจิ้นสกัดข้อมูลอัจฉริยะ (Document Intelligence Engine)
วิเคราะห์ข้อความ OCR ที่ได้รับจากเอกสารของโครงการ Laem Chabang Port Phase 3 และสกัดข้อมูลเมตาดาต้าให้ออกมาเป็น JSON object ที่ถูกต้องตามโครงสร้างที่กำหนด

ข้อความ OCR ที่สกัดได้:
{{ocr_text}}

ข้อมูลอ้างอิงของระบบ (Master Data Context):
{{master_data_context}}

กฎการสกัดข้อมูล:
1. วิเคราะห์และจับคู่ข้อมูลจากข้อความ OCR กับข้อมูลอ้างอิงที่ระบุใน Master Data Context เสมอ
2. สำหรับโครงการ (project) ให้ค้นหาและสกัดส่งกลับเป็น UUID ของโครงการ (projectPublicId)
3. สำหรับประเภทเอกสารโต้ตอบ (correspondence type) ให้สกัดรหัสส่งกลับมา (correspondenceTypeCode) เช่น RFA, Transmittal
4. สำหรับสาขางาน (discipline) ให้ส่งคืนรหัสส่งกลับมา (disciplineCode) เช่น GEN, STR
5. สำหรับหน่วยงานผู้ส่ง (originator) ค้นหาจาก availableOrganizations และส่งกลับมาเป็น UUID (originatorOrganizationPublicId)
6. สำหรับหน่วยงานผู้รับ (recipients) ให้ส่งกลับมาเป็นรายการ Array ของออบเจกต์ ซึ่งมี UUID ขององค์กร (organizationPublicId) และประเภทผู้รับ (recipientType: "TO" หรือ "CC") เสมอ
7. สำหรับหัวข้อเอกสาร (subject) ให้สกัดหัวข้อหรือชื่อเรื่องของเอกสารภาษาไทยหรือภาษาอังกฤษ
8. วันที่ของเอกสาร (documentDate) ให้ส่งคืนในรูปแบบ YYYY-MM-DD
9. รายการแท็ก (tags) สกัดคำสำคัญหรือคำแนะนำ Tags (สอดคล้องกับ availableTags หากมี)
10. สรุปความเนื้อหา (summary) เขียนสรุปรายละเอียดเอกสารสั้นกระชับ 4-5 ประโยคเป็นภาษาไทยอย่างสละสลวย
11. confidence: ค่าความมั่นใจในการสกัดข้อมูลนี้ (ทศนิยมระหว่าง 0.0 ถึง 1.0)

ส่งคืนคำตอบเฉพาะ JSON Object ที่ถูกต้องเท่านั้น ห้ามใส่บล็อกโค้ด markdown หรือคำอธิบายเพิ่มเติมใดๆ
โครงสร้าง JSON ผลลัพธ์:
{
  "projectPublicId": "string หรือ null",
  "correspondenceTypeCode": "string หรือ null",
  "disciplineCode": "string หรือ null",
  "originatorOrganizationPublicId": "string หรือ null",
  "recipients": [
    {
      "organizationPublicId": "string",
      "recipientType": "TO หรือ CC"
    }
  ],
  "subject": "string หรือ null",
  "documentDate": "string:YYYY-MM-DD หรือ null",
  "tags": ["string"],
  "summary": "string หรือ null",
  "confidence": 0.95
}"""

# --- Master Data Context (ดึงจาก DB จริง) ---
MASTER_DATA = {
    "availableProjects": [
        {"code": "LCBP3", "uuid": "c957f1e3-538b-11f1-8c7d-0242ac1d0007", "name": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)"},
        {"code": "LCBP3-C1", "uuid": "c957f44b-538b-11f1-8c7d-0242ac1d0007", "name": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล"},
        {"code": "LCBP3-C2", "uuid": "c957f523-538b-11f1-8c7d-0242ac1d0007", "name": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค"},
        {"code": "LCBP3-C3", "uuid": "c957f57c-538b-11f1-8c7d-0242ac1d0007", "name": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง"},
        {"code": "LCBP3-C4", "uuid": "c957f5cc-538b-11f1-8c7d-0242ac1d0007", "name": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง"},
    ],
    "availableOrganizations": [
        {"code": "กทท.", "uuid": "c94cb0b4-538b-11f1-8c7d-0242ac1d0007", "name": "การท่าเรือแห่งประเทศไทย"},
        {"code": "สคฉ.3", "uuid": "c94cb3f6-538b-11f1-8c7d-0242ac1d0007", "name": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3"},
        {"code": "สคฉ.3-01", "uuid": "c94cb532-538b-11f1-8c7d-0242ac1d0007", "name": "ตรวจรับพัสดุ ที่ปรึกษาควบคุมงาน"},
        {"code": "สคฉ.3-02", "uuid": "c94cb5ab-538b-11f1-8c7d-0242ac1d0007", "name": "ตรวจรับพัสดุ งานทางทะเล"},
        {"code": "สคฉ.3-03", "uuid": "c94cb616-538b-11f1-8c7d-0242ac1d0007", "name": "ตรวจรับพัสดุ อาคารและระบบสาธารณูปโภค"},
        {"code": "คคง.", "uuid": "c94cb8ac-538b-11f1-8c7d-0242ac1d0007", "name": "Construction Supervision Ltd."},
        {"code": "ผรม.1", "uuid": "c94cb907-538b-11f1-8c7d-0242ac1d0007", "name": "Contractor งานทางทะเล"},
        {"code": "ผรม.2", "uuid": "c94cb95e-538b-11f1-8c7d-0242ac1d0007", "name": "Contractor งานก่อสร้าง"},
        {"code": "ผรม.3", "uuid": "c94cb9b3-538b-11f1-8c7d-0242ac1d0007", "name": "Contractor งานก่อสร้าง ส่วนที่ 3"},
        {"code": "ผรม.4", "uuid": "c94cba0c-538b-11f1-8c7d-0242ac1d0007", "name": "Contractor งานก่อสร้าง ส่วนที่ 4"},
    ],
    "availableDisciplines": [
        {"code": "GEN", "name": "งานบริหารโครงการ"},
        {"code": "COD", "name": "สัญญาและข้อโต้แย้ง"},
        {"code": "QSB", "name": "สำรวจปริมาณและควบคุมงบประมาณ"},
        {"code": "PPG", "name": "บริหารแผนและความก้าวหน้า"},
        {"code": "BST", "name": "งานโครงสร้างอาคาร"},
        {"code": "UTL", "name": "งานระบบสาธารณูปโภค"},
        {"code": "EPW", "name": "งานระบบไฟฟ้า"},
        {"code": "SRV", "name": "งานสำรวจ"},
        {"code": "ODC", "name": "สำนักงาน-ควบคุมเอกสาร"},
    ],
    "availableCorrespondenceTypes": [
        {"code": "RFA", "name": "Request for Approval"},
        {"code": "RFI", "name": "Request for Information"},
        {"code": "TRANSMITTAL", "name": "Transmittal"},
        {"code": "LETTER", "name": "Letter"},
        {"code": "MEMO", "name": "Memorandum"},
        {"code": "MOM", "name": "Minutes of Meeting"},
        {"code": "NOTICE", "name": "Notice"},
        {"code": "OTHER", "name": "Other"},
    ],
    "availableTags": [],
}


def check_models():
    req = urllib.request.Request(f"{OLLAMA_URL}/api/ps")
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read())
    models = data.get("models", [])
    if models:
        print(f"  Models in VRAM: {[m['name'] for m in models]}")
    else:
        print("  VRAM: ไม่มี model โหลดอยู่ (ว่าง)")


def main():
    print("=" * 60)
    print("🔍 ตรวจสอบ VRAM ก่อนรัน...")
    check_models()

    ocr_text = OCR_TEXT_FILE.read_text(encoding="utf-8")
    print(f"\n📄 OCR text: {len(ocr_text)} chars")

    prompt = TEMPLATE.replace("{{ocr_text}}", ocr_text).replace(
        "{{master_data_context}}", json.dumps(MASTER_DATA, ensure_ascii=False, indent=2)
    )
    print(f"📝 Total prompt: {len(prompt)} chars")
    print("=" * 60)
    print("⏳ กำลังส่งไปยัง Ollama...")

    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
    }).encode("utf-8")

    start = time.time()
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            result = json.loads(resp.read())
        elapsed = time.time() - start
        raw_response = result.get("response", "")

        print(f"\n✅ Response ใน {elapsed:.1f}s")
        print("-" * 60)
        print(raw_response)
        print("-" * 60)

        # พยายาม parse JSON
        cleaned = raw_response.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(cleaned)
            print("\n✅ JSON parse สำเร็จ!")
            print(json.dumps(parsed, ensure_ascii=False, indent=2))
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON parse ล้มเหลว: {e}")
            print(f"   Raw (200 chars): {raw_response[:200]!r}")

    except urllib.error.URLError as e:
        print(f"\n❌ Connection error: {e}")

    print("\n🔍 ตรวจสอบ VRAM หลังรัน...")
    check_models()


if __name__ == "__main__":
    main()
