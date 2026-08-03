# MCP Qdrant Tools

MCP Qdrant server ให้เครื่องมือสำหรับตรวจสอบและจัดการ vector database ใช้สำหรับ:

- ตรวจสอบ vector collections และ embeddings ที่ใช้ใน AI search (ADR-023/023A)
- Debug ปัญหา semantic search และ retrieval
- ตรวจสอบ multi-tenancy isolation ผ่าน `projectPublicId` filter
- ตรวจสอบ collection health และ point count

## Available Tools

| Tool                     | หน้าที่                                         | ตัวอย่างการใช้งาน                              |
| ------------------------ | ----------------------------------------------- | --------------------------------------------- |
| `qdrant_list_collections`| แสดง collections ทั้งหมด                        | ดูว่ามี collection อะไรบ้าง                  |
| `qdrant_collection_info` | ดู config + stats ของ collection (vector size, distance, point count) | ตรวจสอบ vector dimension และ distance metric |
| `qdrant_scroll`         | เรียกดู points (พร้อม payload) โดยไม่ต้องมี query vector | ดูข้อมูลที่ embed ไว้ใน collection            |
| `qdrant_count`           | นับ points ใน collection (มี optional filter)   | นับจำนวน vectors ใน project ใดๆ               |
| `qdrant_search`          | ทำ vector similarity search (ต้องมี query vector) | ค้นหา documents ที่ใกล้เคียงกับ query vector  |
| `qdrant_health`          | ตรวจสอบ connectivity (lists collections)        | ทดสอบว่า Qdrant server เชื่อมต่อได้           |

## การใช้งานร่วมกับ Development Flow

**เมื่อ debug AI search / retrieval:**

1. ใช้ `qdrant_health` เพื่อยืนยันว่า server เชื่อมต่อได้
2. ใช้ `qdrant_list_collections` เพื่อดู collections ที่มี
3. ใช้ `qdrant_collection_info` เพื่อตรวจสอบ vector dimension และ distance metric
4. ใช้ `qdrant_scroll` เพื่อดู payload ที่ embed ไว้
5. ใช้ `qdrant_search` เพื่อทดสอบ similarity search กับ query vector

**เมื่อตรวจสอบ multi-tenancy (ADR-023A):**

1. ใช้ `qdrant_count` พร้อม filter `{ "projectPublicId": "<uuid>" }` เพื่อนับ points ของ project นั้น
2. ใช้ `qdrant_scroll` พร้อม filter เดียวกันเพื่อดูข้อมูลของ project
3. ยืนยันว่าทุก query มี `projectPublicId` filter — หากไม่มี แสดงว่ามี cross-project leak risk

**เมื่อตรวจสอบ embedding quality:**

1. ใช้ `qdrant_collection_info` เพื่อดู vector size (BGE-M3 = 1024 dims)
2. ใช้ `qdrant_scroll` เพื่อตรวจสอบ payload structure
3. ใช้ `qdrant_search` เพื่อทดสอบ ranking quality ของ results

## ข้อควรระวัง

- **🔴 ห้าม query Qdrant โดยไม่มี `projectPublicId` filter** — จะทำให้เกิด cross-project data leak (ADR-023A)
- **🔴 ห้ามใช้ MCP Qdrant แทน `QdrantService.search()` ใน application code** — MCP ใช้สำหรับ debug/inspect เท่านั้น
- **⚠️ ระวัง `qdrant_search` บน collection ใหญ่** — อาจใช้เวลานาน ควรตั้ง `limit` ให้เหมาะสม
- **✅ ตรวจสอบ vector dimension** — ต้องตรงกับ BGE-M3 (1024) หรือ BGE-Reranker ตาม ADR-034/035
- **✅ ใช้ `qdrant_health` ก่อน operations อื่น** — เพื่อยืนยัน connectivity
- **❌ ห้าม insert/update/delete points ผ่าน MCP** — Qdrant MCP นี้อ่านได้อย่างเดียว (read-only inspection)

## Related Documents

- `specs/06-Decision-Records/ADR-023-ai-integration.md` — AI boundary enforcement
- `specs/06-Decision-Records/ADR-023A-ai-integration-refinement.md` — Qdrant multi-tenancy + `projectPublicId` filter
- `specs/06-Decision-Records/ADR-034-ai-model-stack.md` — BGE-M3 + BGE-Reranker model stack
