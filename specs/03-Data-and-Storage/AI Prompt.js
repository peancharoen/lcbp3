const config = $('Set Configuration').first().json.config;
const fallbackState = $('Check Fallback State').first()?.json || { is_fallback_active: false, recent_error_count: 0 };
const isFallback = fallbackState.is_fallback_active || false;
const model = isFallback ? config.OLLAMA_MODEL_FALLBACK : config.OLLAMA_MODEL_PRIMARY;

// Read DB Context
const dbContext = $('Fetch DB Context').all().map(i => i.json);
const dbProjects = dbContext.filter(d => d.type === 'projects').map(d => ({id: d.id, code: d.text1, name: d.text2}));
const dbDisciplines = dbContext.filter(d => d.type === 'disciplines').map(d => ({id: d.id, th: d.text1, en: d.text2}));
const dbOrgs = dbContext.filter(d => d.type === 'organizations').map(d => ({id: d.id, name: d.text1, code: d.text2}));
const dbTags = dbContext.filter(d => d.type === 'tags').map(d => ({id: d.id, name: d.text1}));
const dbCorrTypes = dbContext.filter(d => d.type === 'correspondence_types').map(d => ({id: d.id, code: d.text1, name: d.text2}));

let systemCategories = ['Correspondence','RFA','Drawing','Transmittal','Report','Other'];
try { systemCategories = $('File Mount Check').first().json.system_categories || systemCategories; } catch (e) {}

const pdfItems = $('Extract PDF Text').all();
// File Validator passes all original Excel JSON fields through (sender, receiver, project_code, etc.)
// Read PDF File overwrites the JSON with binary data, so we must go back one step
const metaItems = $('File Validator').all();

return pdfItems.map((pdfItem, i) => {
  const item = metaItems[i] || pdfItem;

  const docNum = String(item.json.document_number || '');
  const title = String(item.json.title || '');
  const legacyNum = String(item.json.legacy_number || '');
  const issuedDate = String(item.json.issued_date || '');
  const receivedDate = String(item.json.received_date || '');
  const corrType = String(item.json.correspondence_type || '');
  const senderCode = String(item.json.sender || '');
  const receiverCode = String(item.json.receiver || '');
  const projectCode = String(item.json.project_code || '');

  // JavaScript pre-mapping
  const findOrgId = (code) => {
    if (!code) return null;
    const match = dbOrgs.find(o => o.code === code || o.name === code);
    return match ? match.id : null;
  };

  const findProjectId = (code) => {
    if (!code) return config.PROJECT_ID; // Fallback to config
    const match = dbProjects.find(p => p.code === code || p.name === code);
    return match ? match.id : config.PROJECT_ID;
  };

  const senderId = findOrgId(senderCode);
  const receiverId = findOrgId(receiverCode);
  const projectId = findProjectId(projectCode);
  // Excel corrType is likely already the ID based on requirements, but fallback matching to ID if needed
  const corrMatch = dbCorrTypes.find(c => String(c.id) === corrType || c.code === corrType || c.name === corrType);
  const corrTypeId = corrMatch ? corrMatch.id : (isNaN(parseInt(corrType)) ? null : parseInt(corrType));

  const isRFA = docNum.includes('-RFA-') || title.toLowerCase().includes('rfa');

  const systemPrompt = `You are an expert Document Controller for a construction project (LCBP3) in Thailand.
The documents are primarily in THAI and ENGLISH.
Your task is to classify documents and extract metadata from OCR text.
Respond ONLY with valid JSON.`;

  // Use pdfItem for the OCR extracted data, NOT the metaItem
  const pdfText = String(pdfItem.json.data || '').substring(0, 3500).replace(/[^a-zA-Z0-9ก-๙\s\.\/\-:\[\]\(\)]/g, ' ');

  const userPrompt = `Analyze this document:
[EXCEL METADATA]
Document Number: ${docNum || 'Not provided'}
Title: ${title || 'Not provided'}
Issued Date: ${issuedDate || 'Not provided'}
Received Date: ${receivedDate || 'Not provided'}

[DATABASE REFERENCES]
Disciplines: ${JSON.stringify(dbDisciplines)}
Tags: ${JSON.stringify(dbTags)}

[OCR TEXT EXTRACTION]
${pdfText}

Rules:
1. Category: Must be one of ${JSON.stringify(systemCategories)}. If Document Number contains "-RFA-", category MUST be "RFA".
2. Respond with EXACTLY 8 fields in JSON format:
   - "discipline_id": Find 'id' from Disciplines array analyzing text to match 'th' or 'en'. If no match, use ID=64 (from contract LCBP3-C2).
   - "subject": Document subject. If OCR is close to EXCEL METADATA Title, use EXCEL METADATA.
   - "issued_date": Verify from OCR text if it matches ${issuedDate}, format YYYY-MM-DD.
   - "received_date": Verify from OCR text. If empty, default to issued_date.
   - "status": Extract status (e.g., For Information, Approve, Reject, Resubmit). This will be exported as "remark".
   - "summary": 4-5 lines of Thai summary from OCR. This will be exported as "body".
   - "tags": REQUIRED. Identify 2-5 main topics/themes from the document (from Title, subject matter, and OCR text). For each topic, return an object with:
     * "tag_name": short topic name in Thai (2-5 words), e.g. "คอนกรีตผสม", "ทดสอบวัสดุ"
     * "description": one sentence in Thai describing this topic (use key point details). e.g. "การทดสอบค่า slump ของคอนกรีตผสมที่หน้างาน"
     Return as: [{"tag_name": "...", "description": "..."}, ...]
   - "key_points": Array of 3-5 string key points extracted from the document (in Thai).

3. IMPORTANT: You MUST REPLACE the 'null' values in the template below with the actual Integer IDs or text you found. DO NOT reply with literal 'null' if you found a match!

Respond ONLY with this EXACT JSON structure:
{
  "discipline_id": 64,
  "subject": "${title}",
  "issued_date": "${issuedDate}",
  "received_date": "${receivedDate || issuedDate}",
  "status": null,
  "summary": "สรุปเนื้อหา 4-5 บรรทัด...",
  "tags": [{"tag_name": "ชื่อหัวข้อ", "description": "คำอธิบาย key point ของหัวข้อนี้"}],
  "key_points": ["จุดสำคัญที่ 1", "จุดสำคัญที่ 2", "จุดสำคัญที่ 3"],
  "category": "${isRFA ? 'RFA' : 'Correspondence'}",
  "confidence": 0.95
}`;

  return {
    json: {
      ...item.json,
      active_model: model,
      is_fallback: isFallback,
      system_categories: systemCategories,
      pre_mapped: {
        project_id: projectId,
        sender_id: senderId,
        receiver_id: receiverId,
        correspondence_type_id: corrTypeId
      },
      _debug_mapping: {
        excel_project_code: projectCode,
        excel_sender: senderCode,
        excel_receiver: receiverCode,
        excel_corr_type: corrType,
        matched_project: dbProjects.find(p => p.code === projectCode || p.name === projectCode) || null,
        first_org_sample: dbOrgs[0] || null
      },
      ollama_payload: {
        model: model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          num_ctx: 8192
        }
      }
    }
  };
});
