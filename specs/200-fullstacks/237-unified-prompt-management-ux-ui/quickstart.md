# Quickstart: Unified Prompt Management UX/UI

**Feature**: 237-unified-prompt-management-ux-ui
**Date**: 2026-06-14
**Purpose**: Quick start guide for testing and validating the implementation

## Prerequisites

- Backend server running on port 3001
- Frontend server running on port 3000
- Database (MariaDB) with ai_prompts table (from ADR-029)
- Redis running (for BullMQ and caching)
- OCR sidecar running on Desk-5439 (typhoon-np-dms-ocr)
- Ollama running with typhoon2.5-np-dms model

## Database Setup

### 1. Create ai_execution_profiles table

```bash
mysql -u root -p lcbp3 < specs/03-Data-and-Storage/deltas/2026-06-14-create-ai-execution-profiles.sql
```

### 2. Seed execution profiles

```bash
mysql -u root -p lcbp3 < specs/03-Data-and-Storage/deltas/2026-06-14-seed-execution-profiles.sql
```

### 3. Seed additional prompt types

```bash
mysql -u root -p lcbp3 < specs/03-Data-and-Storage/deltas/2026-06-14-seed-additional-prompt-types.sql
```

## Backend Testing

### 1. Test context config endpoints

```bash
# Get context config for OCR extraction v1
curl -H "Authorization: Bearer <token>" \
  http//lloaalhist:3001i/prompts/ocr_extraction/1/context-config

# Update context config
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"projectId": null, "contractId": null}, "pageSize": 5, "language": "th", "outputLanguage": "th"}' \
  http//lloaalhist:3001i/prompts/ocr_extraction/1/context-config
```

### 2. Test execution profile endpoints

```bash
# Get all execution profiles
curl -H "Authorization: Bearer <token>" \
  https://backend.np-dms.work/api/ai/execution-profiles

# Create new profile
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"profileName": "test", "temperature": 0.6, "topP": 0.85, "repeatPenalty": 1.0, "maxTokens": 1024, "ctxSize": 2048, "keepAlive": 0}' \
  https://backend.np-dms.work/api/ai/execution-profiles
```

### 3. Test sandbox RAG Prep endpoint

```bash
# Start RAG Prep job
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Sample text for chunking", "profileId": null}' \
  https://backend.np-dms.work/api/ai/admin/sandbox/rag-prep

# Poll job status (replace <jobId>)
curl -H "Authorization: Bearer <token>" \
  https://backend.np-dms.work/api/ai/admin/sandbox/job/<jobId>
```

## Frontend Testing

### 1. Navigate to Prompt Management page

```
http://localhost:3000/admin/ai/prompt-management
```

### 2. Test Multi-Type Prompt Management

1. Select "OCR Extraction" from Prompt Type dropdown
2. Verify version history shows only OCR extraction versions
3. Click on a version to view template and context config
4. Edit template and context config
5. Click "Save New Version"
6. Verify new version appears in history with incremented version number
7. Click "Activate" on the new version
8. Verify active badge (✅) moves to the new version

### 3. Test Context Configuration

1. Select a prompt version
2. Modify Project Filter field (select a project or leave null)
3. Modify Contract Filter field (select a contract or leave null)
4. Modify Page Size (e.g., change from 3 to 5)
5. Modify Language (e.g., change from "th" to "en")
6. Click "Save New Version"
7. Verify context config is saved with the new version
8. Activate the version
9. Verify context config is applied (check Redis cache)

### 4. Test Three-Step Sandbox Workflow

1. Upload a PDF in the Sandbox tab
2. Click "Run OCR"
3. Wait for OCR results (should show raw OCR text)
4. Select a prompt version from dropdown
5. Click "Run AI Extract"
6. Wait for extracted metadata (should show structured JSON)
7. Click "Test RAG Prep" (optional)
8. Wait for RAG chunks and vectors
9. Review all results
10. Click "Activate This Version" if satisfied

### 5. Test Runtime Parameters vs Context Config Separation

1. Go to Sandbox tab
2. View Runtime Parameters panel
3. Adjust Temperature slider (e.g., from 0.7 to 0.8)
4. Adjust Top-P slider (e.g., from 0.9 to 0.95)
5. Click "Apply to Production"
6. Verify parameters are saved to ai_execution_profiles
7. Go to Prompt Editor panel
8. View Context Config Editor
9. Modify Project Filter (different from Runtime Parameters)
10. Click "Save New Version"
11. Verify context config is saved to ai_prompts (per version)
12. Confirm that Runtime Parameters and Context Config are separate

## Validation Checklist

### Backend

- [x] ai_execution_profiles table created successfully
- [x] Execution profiles seeded (default, fast, accurate)
- [x] Additional prompt types seeded (rag_query_prompt, rag_prep_prompt, classification_prompt)
- [x] GET /api/ai/prompts/:type/:version/context-config returns context config
- [x] PUT /api/ai/prompts/:type/:version/context-config updates context config
- [x] GET /api/ai/execution-profiles returns all profiles
- [x] POST /api/ai/execution-profiles creates new profile
- [x] PUT /api/ai/execution-profiles/:id updates profile
- [x] DELETE /api/ai/execution-profiles/:id deletes non-default profile
- [x] POST /api/ai/admin/sandbox/rag-prep creates sandbox job
- [x] GET /api/ai/admin/sandbox/job/:jobId returns job status and results
- [x] Placeholder validation works (rejects templates without required placeholders)
- [x] Context config validation works (rejects invalid project/contract IDs)
- [x] Redis cache invalidated on version activation
- [x] CASL guards applied to all mutation endpoints

### Frontend

- [x] PromptTypeDropdown switches between prompt types
- [x] VersionHistory filters by selected prompt type
- [x] Active badge (✅) displays correctly
- [x] PromptEditor validates placeholders
- [x] ContextConfigEditor saves and displays context config
- [x] RuntimeParametersPanel displays sliders
- [x] RuntimeParametersPanel applies changes to ai_execution_profiles
- [x] SandboxTabs show 3 tabs (OCR, Extract, RAG Prep)
- [x] Sandbox OCR step returns raw OCR text
- [x] Sandbox AI Extract step returns structured metadata
- [x] Sandbox RAG Prep step returns chunks and vectors
- [x] "Activate This Version" button works from sandbox
- [x] Single page layout consistent with ADR-027
- [x] i18n keys used (no hardcoded text)
- [x] TypeScript strict mode passes (no any, no console.log)

### Integration

- [x] Full 3-step sandbox workflow completes successfully
- [x] Sandbox results match production behavior
- [x] Context config applied to production jobs within 5 seconds
- [x] Runtime parameters applied to sandbox tests immediately
- [x] Version history loads within 1 second
- [x] Sandbox OCR results within 30 seconds
- [x] Sandbox AI Extract results within 60 seconds

## Troubleshooting

### Context config not saving

- Check that ai_prompts table has context_config column (JSON type)
- Verify Redis cache is running
- Check backend logs for validation errors

### Sandbox RAG Prep failing

- Verify Ollama is running with typhoon2.5-np-dms model
- Check embedding service (BGE-M3) is available
- Verify BullMQ ai-realtime queue is processing jobs
- Check Redis for job status

### Runtime parameters not applying

- Verify ai_execution_profiles table exists
- Check that profile is not marked as default (can't modify default)
- Verify CASL permissions (system.manage_all)

### Placeholder validation failing

- Check that template contains required placeholders for the prompt type
- Verify placeholder format: {{placeholder_name}}
- Check backend logs for specific validation error

## Performance Benchmarks

After implementation, verify these targets:

- Version history load: < 1 second
- Context config activation: < 5 seconds
- Sandbox OCR: < 30 seconds
- Sandbox AI Extract: < 60 seconds
- Runtime parameter application: immediate (no page refresh)
