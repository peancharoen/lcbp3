-- File: specs/03-Data-and-Storage/deltas/2026-06-05-add-rag-chunking-prompt.sql
-- เพิ่ม Prompt สำหรับ Semantic Chunking ลงใน ai_prompts table
-- ตาม ADR-035 และ FR-004a
-- Change Log:
-- - 2026-06-05: Initial seed สำหรับ rag_chunking prompt (T002)

INSERT INTO ai_prompts (
    public_id,
    prompt_type,
    version_number,
    template,
    field_schema,
    context_config,
    is_active,
    manual_note,
    activated_at,
    created_by
)
SELECT
    UUID(),
    'rag_chunking',
    1,
    'คุณเป็นผู้ช่วยวิเคราะห์เอกสารและแบ่งเนื้อหาเป็นส่วนๆ ตามหัวข้อ (Semantic Chunking)\nหน้าที่ของคุณคืออ่านข้อความเอกสารที่ได้จาก OCR ด้านล่างนี้ แล้วแบ่งเอกสารออกเป็นชิ้นๆ (Chunks) ตามเนื้อหาและหัวข้อหลัก\nสำหรับแต่ละส่วนที่คุณแบ่ง ให้ล้อมรอบด้วยแท็ก <chunk topic=\"หัวข้อหลักของเนื้อหาส่วนนี้\"> [เนื้อหาในส่วนนี้] </chunk>\n\nกฎในการแบ่งข้อมูล:\n1. ห้ามแก้ไขคำหรือข้อความใดๆ ในเอกสารเด็ดขาด ให้ใช้ข้อความดั้งเดิมจาก OCR ทั้งหมด\n2. พยายามแบ่งส่วนตามขอบเขตเนื้อหาที่สมเหตุสมผล เช่น เมื่อขึ้นหัวข้อใหม่ หรือส่วนเนื้อความที่คนละประเด็นกัน\n3. แต่ละส่วนควรมีความยาวที่อ่านเข้าใจได้และไม่ยาวจนเกินไป\n4. ห้ามตอบข้อความบทนำหรือบทสรุปใดๆ นอกเหนือจากแท็ก <chunk> และข้อความภายในแท็ก\n\nข้อความเอกสาร OCR:\n{{ocr_text}}',
    JSON_OBJECT(
        'type', 'semantic_chunking',
        'model', 'typhoon2.5-np-dms:latest',
        'temperature', 0.1,
        'top_p', 0.9,
        'repeat_penalty', 1.1,
        'keep_alive', -1
    ),
    NULL,
    1,
    'Prompt สำหรับแบ่งข้อความจาก OCR เป็น Chunk ตามหัวข้อความหมายด้วย typhoon2.5 (ADR-035)',
    CURRENT_TIMESTAMP,
    (
        SELECT user_id
        FROM users
        WHERE username = 'superadmin'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompts
    WHERE prompt_type = 'rag_chunking'
      AND version_number = 1
)
ON DUPLICATE KEY UPDATE prompt_type = prompt_type;
