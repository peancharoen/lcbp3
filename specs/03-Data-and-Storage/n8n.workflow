{
  "meta": {
    "instanceId": "lcbp3-migration"
  },
  "nodes": [
    {
      "parameters": {},
      "id": "trigger-1",
      "name": "When clicking ‘Execute Workflow’",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "operation": "read",
        "fileFormat": "xlsx",
        "options": {}
      },
      "id": "spreadsheet-1",
      "name": "Read Excel Data",
      "type": "n8n-nodes-base.spreadsheetFile",
      "typeVersion": 2,
      "position": [200, 0]
    },
    {
      "parameters": {
        "batchSize": 10,
        "options": {}
      },
      "id": "split-in-batches-1",
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [400, 0]
    },
    {
      "parameters": {
        "jsCode": "const item = $input.first();\n\nconst prompt = `You are a Document Controller for a large construction project.\nYour task is to validate document metadata.\nYou MUST respond ONLY with valid JSON. No explanation, no markdown, no extra text.\n\nDocument Number: ${item.json.document_number}\nTitle: ${item.json.title}\nCategory List: [\"Correspondence\",\"RFA\",\"Drawing\",\"Transmittal\",\"Report\",\"Other\"]\n\nRespond ONLY with this exact JSON structure:\n{\n  \"is_valid\": true,\n  \"confidence\": 0.95,\n  \"suggested_category\": \"Correspondence\",\n  \"detected_issues\": [],\n  \"suggested_title\": null\n}`;\n\nreturn [{\n  json: {\n    ...item.json,\n    ollama_payload: {\n      model: \"llama3.2:3b\",\n      format: \"json\",\n      stream: false,\n      prompt: prompt\n    }\n  }\n}];"
      },
      "id": "code-1",
      "name": "Build Prompt",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [620, 0]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://192.168.20.100:11434/api/generate",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.ollama_payload }}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "http-1",
      "name": "Ollama Local API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [840, 0]
    },
    {
      "parameters": {
        "jsCode": "const items = $input.all();\nconst parsed = [];\n\nfor (const item of items) {\n  try {\n    let raw = item.json.response || '';\n    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();\n    const aiResult = JSON.parse(raw);\n    parsed.push({ json: { ...item.json, ai_result: aiResult } });\n  } catch (err) {\n     parsed.push({ json: { ...item.json, ai_result: { confidence: 0, is_valid: false, error: err.message } } });\n  }\n}\nreturn parsed;"
      },
      "id": "code-2",
      "name": "Parse JSON",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1040, 0]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.ai_result.confidence >= 0.85 && $json.ai_result.is_valid }}",
              "value2": true
            }
          ]
        }
      },
      "id": "if-1",
      "name": "Confidence >= 0.85?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [1240, 0]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://<YOUR_BACKEND_IP>:3000/api/migration/import",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Idempotency-Key",
              "value": "={{ $json.document_number }}:BATCH-001"
            },
            {
              "name": "Authorization",
              "value": "Bearer <YOUR_MIGRATION_TOKEN>"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"source_file_path\": \"/share/np-dms/staging_ai/{{$json.document_number}}.pdf\",\n  \"document_number\": \"{{$json.document_number}}\",\n  \"title\": \"{{$json.ai_result.suggested_title || $json.title}}\",\n  \"category\": \"{{$json.ai_result.suggested_category}}\",\n  \"revision\": 1, \n  \"batch_id\": \"BATCH_001\",\n  \"ai_confidence\": {{$json.ai_result.confidence}},\n  \"ai_issues\": {{$json.ai_result.detected_issues}},\n  \"legacy_document_number\": \"{{$json.legacy_number}}\"\n}",
        "options": {}
      },
      "id": "http-2",
      "name": "LCBP3 Backend (Auto Ingest)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1460, -100]
    },
    {
      "parameters": {
        "jsCode": "return [{ json: { message: \"Sent to Human Review Queue OR Check AI Error Log\", data: $input.first().json } }];"
      },
      "id": "code-3",
      "name": "Review Queue / Reject Log",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1460, 100]
    }
  ],
  "connections": {
    "When clicking ‘Execute Workflow’": {
      "main": [
        [
          {
            "node": "Read Excel Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Excel Data": {
      "main": [
        [
          {
            "node": "Split In Batches",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split In Batches": {
      "main": [
        [
          {
            "node": "Build Prompt",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Build Prompt": {
      "main": [
        [
          {
            "node": "Ollama Local API",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Ollama Local API": {
      "main": [
        [
          {
            "node": "Parse JSON",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse JSON": {
      "main": [
        [
          {
            "node": "Confidence >= 0.85?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Confidence >= 0.85?": {
      "main": [
        [
          {
            "node": "LCBP3 Backend (Auto Ingest)",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Review Queue / Reject Log",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
