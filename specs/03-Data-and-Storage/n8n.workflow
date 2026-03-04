{
  "name": "LCBP3 Migration Workflow v1.8.0",
  "meta": {
    "instanceId": "lcbp3-migration-free"
  },
  "settings": {
    "executionOrder": "v1"
  },
  "nodes": [
    {
      "parameters": {},
      "id": "trigger-manual",
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [
        0,
        0
      ],
      "notes": "กดรันด้วยตนเอง"
    },
    {
      "parameters": {
        "jsCode": "// ============================================\n// CONFIGURATION - แก้ไขค่าที่นี่\n// ============================================\nconst CONFIG = {\n  // Ollama Settings\n  OLLAMA_HOST: 'http://192.168.20.100:11434',\n  OLLAMA_MODEL_PRIMARY: 'llama3.2:3b',\n  OLLAMA_MODEL_FALLBACK: 'mistral:7b-instruct-q4_K_M',\n  \n  // Backend Settings\n  BACKEND_URL: 'https://api.np-dms.work',\n  MIGRATION_TOKEN: 'Bearer YOUR_MIGRATION_TOKEN_HERE',\n  \n  // Batch Settings\n  BATCH_SIZE: 10,\n  BATCH_ID: 'migration_20260226',\n  DELAY_MS: 2000,\n  \n  // Thresholds\n  CONFIDENCE_HIGH: 0.85,\n  CONFIDENCE_LOW: 0.60,\n  MAX_RETRY: 3,\n  FALLBACK_THRESHOLD: 5,\n  \n  // Paths\n  STAGING_PATH: '/home/node/.n8n-files/staging_ai',\n  LOG_PATH: '/home/node/.n8n-files/migration_logs',\n  \n  // Database\n  DB_HOST: '192.168.1.100',\n  DB_PORT: 3306,\n  DB_NAME: 'lcbp3_db',\n  DB_USER: 'migration_bot',\n  DB_PASSWORD: 'YOUR_DB_PASSWORD_HERE'\n};\n\nreturn [{ json: { config_loaded: true, timestamp: new Date().toISOString(), config: CONFIG } }];"
      },
      "id": "config-setter",
      "name": "Set Configuration",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        200,
        0
      ],
      "notes": "กำหนดค่า Configuration ทั้งหมด - แก้ไขที่นี่ก่อนรัน"
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{$('Set Configuration').first().json.config.BACKEND_URL}}/api/master/correspondence-types",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "={{$workflow.staticData.config.MIGRATION_TOKEN}}"
            }
          ]
        },
        "options": {
          "timeout": 10000
        }
      },
      "id": "preflight-categories",
      "name": "Fetch Categories",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        400,
        0
      ],
      "notes": "ดึง Categories จาก Backend"
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{$('Set Configuration').first().json.config.BACKEND_URL}}/health",
        "options": {
          "timeout": 5000
        }
      },
      "id": "preflight-health",
      "name": "Check Backend Health",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        400,
        200
      ],
      "notes": "ตรวจสอบ Backend พร้อมใช้งาน",
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "const fs = require('fs');\nconst config = $('Set Configuration').first().json.config;\n\n// Check file mount\ntry {\n  const files = fs.readdirSync(config.STAGING_PATH);\n  if (files.length === 0) throw new Error('staging_ai is empty');\n  \n  // Check write permission to log path\n  fs.writeFileSync(`${config.LOG_PATH}/.preflight_ok`, new Date().toISOString());\n  \n  // Store categories\n  const categories = $input.first().json.categories || \n    ['Correspondence','RFA','Drawing','Transmittal','Report','Other'];\n  $('File Mount Check').first().json.system_categories = categories;\n  \n  return [{ json: { \n    preflight_ok: true, \n    file_count: files.length,\n    system_categories: categories,\n    timestamp: new Date().toISOString()\n  }}];\n} catch (err) {\n  throw new Error(`Pre-flight check failed: ${err.message}`);\n}"
      },
      "id": "preflight-check",
      "name": "File Mount Check",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        600,
        0
      ],
      "notes": "ตรวจสอบ File System และเก็บ Categories"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "host": "={{$('Set Configuration').first().json.config.DB_HOST}}",
        "port": "={{$('Set Configuration').first().json.config.DB_PORT}}",
        "database": "={{$('Set Configuration').first().json.config.DB_NAME}}",
        "user": "={{$('Set Configuration').first().json.config.DB_USER}}",
        "password": "={{$('Set Configuration').first().json.config.DB_PASSWORD}}",
        "query": "SELECT last_processed_index, status FROM migration_progress WHERE batch_id = '{{$('Set Configuration').first().json.config.BATCH_ID}}' LIMIT 1",
        "options": {}
      },
      "id": "checkpoint-read",
      "name": "Read Checkpoint",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [
        800,
        0
      ],
      "notes": "อ่านตำแหน่งล่าสุดที่ประมวลผล",
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "operation": "toData",
        "binaryProperty": "data",
        "options": {
          "sheetName": "Sheet1"
        }
      },
      "id": "excel-reader",
      "name": "Read Excel",
      "type": "n8n-nodes-base.spreadsheetFile",
      "typeVersion": 2,
      "position": [
        800,
        200
      ],
      "notes": "อ่านไฟล์ Excel รายการเอกสาร"
    },
    {
      "parameters": {
        "jsCode": "const checkpoint = $input.first().json[0] || { last_processed_index: 0, status: 'NEW' };\nconst startIndex = checkpoint.last_processed_index || 0;\nconst config = $('Set Configuration').first().json.config;\n\nconst allItems = $('Read Excel').all()[0].json.data || [];\nconst remaining = allItems.slice(startIndex);\nconst currentBatch = remaining.slice(0, config.BATCH_SIZE);\n\n// Encoding Normalization\nconst normalize = (str) => {\n  if (!str) return '';\n  return String(str).normalize('NFC').trim();\n};\n\nreturn currentBatch.map((item, i) => ({\n  json: {\n    document_number: normalize(item.document_number || item['Document Number']),\n    title: normalize(item.title || item.Title || item['Subject']),\n    legacy_number: normalize(item.legacy_number || item['Legacy Number']),\n    excel_revision: item.revision || item.Revision || 1,\n    original_index: startIndex + i,\n    batch_id: config.BATCH_ID,\n    file_name: `${normalize(item.document_number)}.pdf`\n  }\n}));"
      },
      "id": "batch-processor",
      "name": "Process Batch + Encoding",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1000,
        0
      ],
      "notes": "ตัด Batch + Normalize UTF-8"
    },
    {
      "parameters": {
        "jsCode": "const fs = require('fs');\nconst path = require('path');\nconst config = $('Set Configuration').first().json.config;\n\nconst items = $input.all();\nconst validated = [];\nconst errors = [];\n\nfor (const item of items) {\n  const docNum = item.json.document_number;\n  \n  // Sanitize filename\n  const safeName = path.basename(String(docNum).replace(/[^a-zA-Z0-9\\-_.]/g, '_')).normalize('NFC');\n  const filePath = path.resolve(config.STAGING_PATH, `${safeName}.pdf`);\n  \n  // Path traversal check\n  if (!filePath.startsWith(config.STAGING_PATH)) {\n    errors.push({\n      ...item,\n      json: { ...item.json, error: 'Path traversal detected', error_type: 'SECURITY', file_exists: false }\n    });\n    continue;\n  }\n  \n  try {\n    if (fs.existsSync(filePath)) {\n      const stats = fs.statSync(filePath);\n      validated.push({\n        ...item,\n        json: { ...item.json, file_exists: true, file_size: stats.size, file_path: filePath }\n      });\n    } else {\n      errors.push({\n        ...item,\n        json: { ...item.json, error: `File not found: ${safeName}.pdf`, error_type: 'FILE_NOT_FOUND', file_exists: false }\n      });\n    }\n  } catch (err) {\n    errors.push({\n      ...item,\n      json: { ...item.json, error: err.message, error_type: 'FILE_ERROR', file_exists: false }\n    });\n  }\n}\n\n// Output 0: Validated, Output 1: Errors\nreturn [validated, errors];"
      },
      "id": "file-validator",
      "name": "File Validator",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1200,
        0
      ],
      "notes": "ตรวจสอบไฟล์ PDF มีอยู่จริง + Sanitize path"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "host": "={{$('Set Configuration').first().json.config.DB_HOST}}",
        "port": "={{$('Set Configuration').first().json.config.DB_PORT}}",
        "database": "={{$('Set Configuration').first().json.config.DB_NAME}}",
        "user": "={{$('Set Configuration').first().json.config.DB_USER}}",
        "password": "={{$('Set Configuration').first().json.config.DB_PASSWORD}}",
        "query": "SELECT is_fallback_active, recent_error_count FROM migration_fallback_state WHERE batch_id = '{{$('Set Configuration').first().json.config.BATCH_ID}}' LIMIT 1",
        "options": {}
      },
      "id": "fallback-check",
      "name": "Check Fallback State",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [
        1400,
        -200
      ],
      "notes": "ตรวจสอบว่าต้องใช้ Fallback Model หรือไม่",
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "const config = $('Set Configuration').first().json.config;\nconst fallbackState = $input.first().json[0] || { is_fallback_active: false, recent_error_count: 0 };\n\nconst isFallback = fallbackState.is_fallback_active || false;\nconst model = isFallback ? config.OLLAMA_MODEL_FALLBACK : config.OLLAMA_MODEL_PRIMARY;\n\nconst systemCategories = $('File Mount Check').first().json.system_categories || \n  ['Correspondence','RFA','Drawing','Transmittal','Report','Other'];\n\nconst items = $('File Validator').all();\n\nreturn items.map(item => {\n  const systemPrompt = `You are a Document Controller for a large construction project.\nYour task is to validate document metadata.\nYou MUST respond ONLY with valid JSON. No explanation, no markdown, no extra text.\nIf there are no issues, \"detected_issues\" must be an empty array [].`;\n\n  const userPrompt = `Validate this document metadata and respond in JSON:\n\nDocument Number: ${item.json.document_number}\nTitle: ${item.json.title}\nExpected Pattern: [ORG]-[TYPE]-[SEQ] e.g. \"TCC-COR-0001\"\nCategory List (MUST match system enum exactly): ${JSON.stringify(systemCategories)}\n\nRespond ONLY with this exact JSON structure:\n{\n  \"is_valid\": true | false,\n  \"confidence\": 0.0 to 1.0,\n  \"suggested_category\": \"<one from Category List>\",\n  \"detected_issues\": [\"<issue1>\"],\n  \"suggested_title\": \"<corrected title or null>\"\n}`;\n\n  return {\n    json: {\n      ...item.json,\n      active_model: model,\n      is_fallback: isFallback,\n      system_categories: systemCategories,\n      ollama_payload: {\n        model: model,\n        prompt: `${systemPrompt}\\n\\n${userPrompt}`,\n        stream: false,\n        format: 'json'\n      }\n    }\n  };\n});"
      },
      "id": "prompt-builder",
      "name": "Build AI Prompt",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1400,
        0
      ],
      "notes": "สร้าง Prompt โดยใช้ Categories จาก System"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$('Set Configuration').first().json.config.OLLAMA_HOST}}/api/generate",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.ollama_payload }}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "ollama-call",
      "name": "Ollama AI Analysis",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        1600,
        0
      ],
      "notes": "เรียก Ollama วิเคราะห์เอกสาร"
    },
    {
      "parameters": {
        "jsCode": "const items = $input.all();\nconst parsed = [];\nconst parseErrors = [];\n\nfor (const item of items) {\n  try {\n    let raw = item.json.response || '';\n    \n    // Clean markdown\n    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();\n    const result = JSON.parse(raw);\n    \n    // Schema Validation\n    if (typeof result.is_valid !== 'boolean') throw new Error('is_valid must be boolean');\n    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {\n      throw new Error('confidence must be float 0.0-1.0');\n    }\n    if (!Array.isArray(result.detected_issues)) throw new Error('detected_issues must be array');\n    \n    // Enum Validation\n    const systemCategories = item.json.system_categories || [];\n    if (!systemCategories.includes(result.suggested_category)) {\n      throw new Error(`Category \"${result.suggested_category}\" not in system enum`);\n    }\n    \n    parsed.push({\n      ...item,\n      json: { ...item.json, ai_result: result, parse_error: null }\n    });\n  } catch (err) {\n    parseErrors.push({\n      ...item,\n      json: {\n        ...item.json,\n        ai_result: null,\n        parse_error: err.message,\n        raw_ai_response: item.json.response,\n        error_type: 'AI_PARSE_ERROR'\n      }\n    });\n  }\n}\n\nreturn [parsed, parseErrors];"
      },
      "id": "json-parser",
      "name": "Parse & Validate AI Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1800,
        0
      ],
      "notes": "Parse JSON + Validate Schema + Enum Check"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "host": "={{$('Set Configuration').first().json.config.DB_HOST}}",
        "port": "={{$('Set Configuration').first().json.config.DB_PORT}}",
        "database": "={{$('Set Configuration').first().json.config.DB_NAME}}",
        "user": "={{$('Set Configuration').first().json.config.DB_USER}}",
        "password": "={{$('Set Configuration').first().json.config.DB_PASSWORD}}",
        "query": "INSERT INTO migration_fallback_state (batch_id, recent_error_count, is_fallback_active) VALUES ('{{$('Set Configuration').first().json.config.BATCH_ID}}', 1, FALSE) ON DUPLICATE KEY UPDATE recent_error_count = recent_error_count + 1, is_fallback_active = CASE WHEN recent_error_count + 1 >= {{$('Set Configuration').first().json.config.FALLBACK_THRESHOLD}} THEN TRUE ELSE is_fallback_active END, updated_at = NOW()",
        "options": {}
      },
      "id": "fallback-update",
      "name": "Update Fallback State",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [
        2000,
        200
      ],
      "notes": "เพิ่ม Error count และตรวจสอบ Fallback threshold"
    },
    {
      "parameters": {
        "jsCode": "const config = $('Set Configuration').first().json.config;\nconst items = $('Parse & Validate AI Response').all();\n\nconst autoIngest = [];\nconst reviewQueue = [];\nconst rejectLog = [];\nconst errorLog = [];\n\nfor (const item of items) {\n  if (item.json.parse_error || !item.json.ai_result) {\n    errorLog.push(item);\n    continue;\n  }\n  \n  const ai = item.json.ai_result;\n  \n  // Revision Drift Protection (ถ้ามีข้อมูลจาก DB)\n  if (item.json.current_db_revision !== undefined) {\n    const expectedRev = item.json.current_db_revision + 1;\n    if (parseInt(item.json.excel_revision) !== expectedRev) {\n      reviewQueue.push({\n        ...item,\n        json: { ...item.json, review_reason: `Revision drift: Excel=${item.json.excel_revision}, Expected=${expectedRev}` }\n      });\n      continue;\n    }\n  }\n  \n  // Confidence Routing\n  if (ai.confidence >= config.CONFIDENCE_HIGH && ai.is_valid === true) {\n    autoIngest.push(item);\n  } else if (ai.confidence >= config.CONFIDENCE_LOW) {\n    reviewQueue.push({\n      ...item,\n      json: { ...item.json, review_reason: `Confidence ${ai.confidence.toFixed(2)} < ${config.CONFIDENCE_HIGH}` }\n    });\n  } else {\n    rejectLog.push({\n      ...item,\n      json: { ...item.json, reject_reason: ai.is_valid === false ? 'AI marked invalid' : `Confidence ${ai.confidence.toFixed(2)} < ${config.CONFIDENCE_LOW}` }\n    });\n  }\n}\n\n// Output 0: Auto, 1: Review, 2: Reject, 3: Error\nreturn [autoIngest, reviewQueue, rejectLog, errorLog];"
      },
      "id": "confidence-router",
      "name": "Confidence Router",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2000,
        0
      ],
      "notes": "แยกตาม Confidence: Auto(≥0.85) / Review(≥0.60) / Reject(<0.60)"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$('Set Configuration').first().json.config.BACKEND_URL}}/api/migration/import",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "={{$workflow.staticData.config.MIGRATION_TOKEN}}"
            },
            {
              "name": "Idempotency-Key",
              "value": "={{$json.document_number}}:{{$workflow.staticData.config.BATCH_ID}}"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"document_number\": \"{{$json.document_number}}\",\n  \"title\": \"{{$json.ai_result.suggested_title || $json.title}}\",\n  \"category\": \"{{$json.ai_result.suggested_category}}\",\n  \"source_file_path\": \"{{$json.file_path}}\",\n  \"ai_confidence\": {{$json.ai_result.confidence}},\n  \"ai_issues\": {{JSON.stringify($json.ai_result.detected_issues)}},\n  \"migrated_by\": \"SYSTEM_IMPORT\",\n  \"batch_id\": \"{{$('Set Configuration').first().json.config.BATCH_ID}}\",\n  \"details\": {\n    \"legacy_number\": \"{{$json.legacy_number}}\"\n  }\n}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "backend-import",
      "name": "Import to Backend",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        2200,
        -200
      ],
      "notes": "ส่งข้อมูลเข้า LCBP3 Backend พร้อม Idempotency-Key"
    },
    {
      "parameters": {
        "jsCode": "const item = $input.first();\nconst shouldCheckpoint = item.json.original_index % 10 === 0;\n\nreturn [{\n  json: {\n    ...item.json,\n    should_update_checkpoint: shouldCheckpoint,\n    checkpoint_index: item.json.original_index,\n    import_status: 'success',\n    timestamp: new Date().toISOString()\n  }\n}];"
      },
      "id": "checkpoint-flag",
      "name": "Flag Checkpoint",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2400,
        -200
      ],
      "notes": "กำหนดว่าจะบันทึก Checkpoint หรือไม่ (ทุก 10 records)"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "host": "={{$('Set Configuration').first().json.config.DB_HOST}}",
        "port": "={{$('Set Configuration').first().json.config.DB_PORT}}",
        "database": "={{$('Set Configuration').first().json.config.DB_NAME}}",
        "user": "={{$('Set Configuration').first().json.config.DB_USER}}",
        "password": "={{$('Set Configuration').first().json.config.DB_PASSWORD}}",
        "query": "INSERT INTO migration_progress (batch_id, last_processed_index, status) VALUES ('{{$('Set Configuration').first().json.config.BATCH_ID}}', {{$json.checkpoint_index}}, 'RUNNING') ON DUPLICATE KEY UPDATE last_processed_index = {{$json.checkpoint_index}}, updated_at = NOW()",
        "options": {}
      },
      "id": "checkpoint-save",
      "name": "Save Checkpoint",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [
        2600,
        -200
      ],
      "notes": "บันทึกความคืบหน้าลง Database"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "host": "={{$('Set Configuration').first().json.config.DB_HOST}}",
        "port": "={{$('Set Configuration').first().json.config.DB_PORT}}",
        "database": "={{$('Set Configuration').first().json.config.DB_NAME}}",
        "user": "={{$('Set Configuration').first().json.config.DB_USER}}",
        "password": "={{$('Set Configuration').first().json.config.DB_PASSWORD}}",
        "query": "INSERT INTO migration_review_queue (document_number, title, original_title, ai_suggested_category, ai_confidence, ai_issues, review_reason, status, created_at) VALUES ('{{$json.document_number}}', '{{$json.ai_result.suggested_title || $json.title}}', '{{$json.title}}', '{{$json.ai_result.suggested_category}}', {{$json.ai_result.confidence}}, '{{JSON.stringify($json.ai_result.detected_issues)}}', '{{$json.review_reason}}', 'PENDING', NOW()) ON DUPLICATE KEY UPDATE status = 'PENDING', review_reason = '{{$json.review_reason}}', created_at = NOW()",
        "options": {}
      },
      "id": "review-queue-insert",
      "name": "Insert Review Queue",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [
        2200,
        0
      ],
      "notes": "บันทึกรายการที่ต้องตรวจสอบโดยคน (ไม่สร้าง Correspondence)"
    },
    {
      "parameters": {
        "jsCode": "const fs = require('fs');\nconst item = $input.first();\nconst config = $('Set Configuration').first().json.config;\n\nconst csvPath = `${config.LOG_PATH}/reject_log.csv`;\nconst header = 'timestamp,document_number,title,reject_reason,ai_confidence,ai_issues\\n';\nconst esc = (s) => `\"${String(s || '').replace(/\"/g, '\"\"')}\"`;\n\nif (!fs.existsSync(csvPath)) {\n  fs.writeFileSync(csvPath, header, 'utf8');\n}\n\nconst line = [\n  new Date().toISOString(),\n  esc(item.json.document_number),\n  esc(item.json.title),\n  esc(item.json.reject_reason),\n  item.json.ai_result?.confidence ?? 'N/A',\n  esc(JSON.stringify(item.json.ai_result?.detected_issues || []))\n].join(',') + '\\n';\n\nfs.appendFileSync(csvPath, line, 'utf8');\n\nreturn [$input.first()];"
      },
      "id": "reject-logger",
      "name": "Log Reject to CSV",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2200,
        200
      ],
      "notes": "บันทึกรายการที่ถูกปฏิเสธลง CSV"
    },
    {
      "parameters": {
        "jsCode": "const fs = require('fs');\nconst items = $input.all();\nconst config = $('Set Configuration').first().json.config;\n\nconst csvPath = `${config.LOG_PATH}/error_log.csv`;\nconst header = 'timestamp,document_number,error_type,error_message,raw_ai_response\\n';\nconst esc = (s) => `\"${String(s || '').replace(/\"/g, '\"\"')}\"`;\n\nif (!fs.existsSync(csvPath)) {\n  fs.writeFileSync(csvPath, header, 'utf8');\n}\n\nfor (const item of items) {\n  const line = [\n    new Date().toISOString(),\n    esc(item.json.document_number),\n    esc(item.json.error_type || 'UNKNOWN'),\n    esc(item.json.error || item.json.parse_error),\n    esc(item.json.raw_ai_response || '')\n  ].join(',') + '\\n';\n  \n  fs.appendFileSync(csvPath, line, 'utf8');\n}\n\nreturn items;"
      },
      "id": "error-logger-csv",
      "name": "Log Error to CSV",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1400,
        400
      ],
      "notes": "บันทึก Error ลง CSV (จาก File Validator)"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "host": "={{$('Set Configuration').first().json.config.DB_HOST}}",
        "port": "={{$('Set Configuration').first().json.config.DB_PORT}}",
        "database": "={{$('Set Configuration').first().json.config.DB_NAME}}",
        "user": "={{$('Set Configuration').first().json.config.DB_USER}}",
        "password": "={{$('Set Configuration').first().json.config.DB_PASSWORD}}",
        "query": "INSERT INTO migration_errors (batch_id, document_number, error_type, error_message, raw_ai_response, created_at) VALUES ('{{$('Set Configuration').first().json.config.BATCH_ID}}', '{{$json.document_number}}', '{{$json.error_type || \"UNKNOWN\"}}', '{{$json.error || $json.parse_error}}', '{{$json.raw_ai_response || \"\"}}', NOW())",
        "options": {}
      },
      "id": "error-logger-db",
      "name": "Log Error to DB",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [
        2000,
        400
      ],
      "notes": "บันทึก Error ลง MariaDB"
    },
    {
      "parameters": {
        "amount": "={{$('Set Configuration').first().json.config.DELAY_MS}}",
        "unit": "milliseconds"
      },
      "id": "delay-node",
      "name": "Delay",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [
        2800,
        0
      ],
      "notes": "หน่วงเวลาระหว่าง Batches"
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [
        [
          {
            "node": "Set Configuration",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Configuration": {
      "main": [
        [
          {
            "node": "Fetch Categories",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Categories": {
      "main": [
        [
          {
            "node": "File Mount Check",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "File Mount Check": {
      "main": [
        [
          {
            "node": "Read Checkpoint",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Checkpoint": {
      "main": [
        [
          {
            "node": "Process Batch + Encoding",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Process Batch + Encoding": {
      "main": [
        [
          {
            "node": "File Validator",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "File Validator": {
      "main": [
        [
          {
            "node": "Build AI Prompt",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Log Error to CSV",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Build AI Prompt": {
      "main": [
        [
          {
            "node": "Ollama AI Analysis",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Ollama AI Analysis": {
      "main": [
        [
          {
            "node": "Parse & Validate AI Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse & Validate AI Response": {
      "main": [
        [
          {
            "node": "Confidence Router",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Update Fallback State",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Confidence Router": {
      "main": [
        [
          {
            "node": "Import to Backend",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Insert Review Queue",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Log Reject to CSV",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Log Error to DB",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Import to Backend": {
      "main": [
        [
          {
            "node": "Flag Checkpoint",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Flag Checkpoint": {
      "main": [
        [
          {
            "node": "Save Checkpoint",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Log Error to CSV": {
      "main": [
        [
          {
            "node": "Log Error to DB",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
