# Session — 2026-06-12 (AI Runtime Policy Refactor Quickstart Fix)

## Summary

แก้ไข `specs/200-fullstacks/235-ai-runtime-policy-refactor/quickstart.md` ให้ใช้งานได้จริง หลังจากพบว่าขั้นตอนการทดสอบมีข้อผิดพลาดหลายจุดจากการเดาเอาเองแทนที่จะอ่าน config จริง

## ปัญหาที่พบ (Root Cause)

1. **ไม่ได้อ่าน AGENTS.md ก่อน** — ละเมิด Thought & Planning Protocol โดยไม่ทำ Analysis Phase
2. **เดา Backend URL** — บอกว่าใช้ `192.168.10.8:3001` แต่จริงๆ คือ `https://backend.np-dms.work/api` (ผ่าน NPM)
3. **เดา Port** — บอกว่า backend ใช้ port 3001 แต่จริงๆ คือ 3000 ใน container
4. **เดา API Path** — ใส่ `/api` ซ้ำทำให้เป็น `/api/api/...` → 404
5. **เดา Response Structure** — ใช้ `accessToken` แทน `access_token`, ไม่รู้ว่ามี `data` wrapper
6. **เดา Login Field** — บอกว่าใช้ `email` แต่จริงๆ ต้องใช้ `username`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `specs/200-fullstacks/235-ai-runtime-policy-refactor/quickstart.md` | อัปเดต Backend URL, ลบ `/api` ซ้ำ, แก้ login field เป็น `username`, แก้ token extraction path, ใช้ Python แทน jq, แก้ error response path |

### Changes Detail

```markdown
// Change Log:
// - 2026-06-11: Verification quickstart for AI Runtime Policy Refactor
// - 2026-06-12: เพิ่ม PowerShell syntax และ environment variable setup
// - 2026-06-12: แก้ไข Backend URL และ API paths ตาม config จริง
```

**Backend URL ที่ถูกต้อง:**
| Environment | URL |
|-------------|-----|
| Production (QNAP + NPM) | `https://backend.np-dms.work/api` |
| QNAP Internal | `http://backend:3000` |
| Local dev | `http://localhost:3001` |

**API Paths ที่แก้ไข:**
- `$BACKEND_URL/auth/login` (แทน `/api/auth/login`)
- `$BACKEND_URL/ai/jobs` (แทน `/api/api/ai/jobs`)

**Token Extraction ที่ถูกต้อง:**
```bash
export TOKEN=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['access_token'])")
```

**Error Response Path:**
```bash
python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', {}).get('statusCode'))"
```

## กฎที่ Lock แล้ว

| กฎ | คำอธิบาย |
|----|---------|
| **Always read config first** | ก่อนแนะนำ URL/Port/Path ต้องอ่าน `docker-compose-app.yml` และ `deploy.sh` |
| **Never guess** | ห้ามเดา environment variables, ports, paths, response structures |
| **AGENTS.md Protocol** | ต้องทำ Analysis Phase → Planning Phase → Execution ตามลำดับ |
| **Verify with source** | ต้อง grep/read source code ก่อนแก้ไข API-related issues |

## Verification

การทดสอบที่สำเร็จ:

| Gate | คำสั่ง | ผลลัพธ์ | สถานะ |
|------|--------|---------|-------|
| **1A** | `curl ... -d '{"type": "rag-query", "model": {"key": "typhoon2.5-np-dms:latest"}}'` | `400` | ✅ |
| **1B** | `curl ... -d '{"type": "rag-query", "temperature": 0.9}'` | `400` | ✅ |
| **1D** | `curl ... -H "Bearer $NON_ADMIN_TOKEN" ... "executionProfile": "large-context"` | `403` | ✅ |

**หมายเหตุ:** Gate 1C ยังไม่ได้ทดสอบเต็มรูปแบบเพราะ database ไม่มี document (correspondences = 0)

## Remaining Work

- [ ] Gate 1C: ต้องสร้าง document จริงในระบบก่อนทดสอบ `executionProfile: "balanced"` (expected 201)
- [ ] Gate 2: ตรวจสอบ audit log และ Admin Console labels
- [ ] แก้ไข `ai_available_models` ใน database ให้ใช้ canonical names (`np-dms-ai`, `np-dms-ocr`) แทน typhoon names

## Lesson Learned

**ผิด:** เดาเอาเองว่า backend ใช้ port 3001 และ IP 192.168.10.8:3001 โดยไม่ได้อ่าน config
**ถูก:** ต้องอ่าน `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml` และ `scripts/deploy.sh` ก่อนเสมอ

**ผิด:** คิดว่า response structure เป็น `{ accessToken: ... }` หรือ `{ access_token: ... }`
**ถูก:** ต้องดู source code ก่อน — จริงๆ คือ `{ data: { access_token: ... } }` เพราะ TransformInterceptor wrap response

**ผิด:** ใช้ jq โดยไม่รู้ว่า user ไม่ได้ติดตั้ง
**ถูก:** ใช้ Python เป็นหลักเพราะมีอยู่แล้วในทุกระบบ
