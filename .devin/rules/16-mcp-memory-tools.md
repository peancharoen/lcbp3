# MCP Memory Tools

MCP Memory server ให้เครื่องมือสำหรับจัดการ Knowledge Graph และ Long-term Memory ใช้สำหรับ:

- จัดเก็บความรู้และ context ของโปรเจกต์ในรูปแบบ Graph (Entities + Relations + Observations)
- ค้นหาและดึงข้อมูล context จาก memory ที่บันทึกไว้ใน session ก่อนหน้า
- สร้าง/แก้ไข/ลบ entities, relations, และ observations ใน knowledge graph

## Available Tools

| Tool                  | หน้าที่                                      | ตัวอย่างการใช้งาน                            |
| --------------------- | -------------------------------------------- | -------------------------------------------- |
| `create_entities`     | สร้าง entities ใหม่หลายตัวพร้อม observations | สร้าง entity ใหม่เช่น Project, User, Task    |
| `create_relations`    | สร้าง relations ระหว่าง entities             | สร้าง relation: Project → has → User         |
| `add_observations`    | เพิ่ม observations ให้ entity ที่มีอยู่แล้ว  | เพิ่ม context เพิ่มเติมให้ entity            |
| `delete_entities`     | ลบ entities และ relations ที่เกี่ยวข้อง      | ลบ entity ที่ไม่ใช้แล้ว                      |
| `delete_relations`    | ลบ relations ระหว่าง entities                | ลบ relation ที่ผิดหรือไม่ใช้แล้ว             |
| `delete_observations` | ลบ observations จาก entity                   | ลบ context ที่ผิดหรือล้าสุด                  |
| `open_nodes`          | ดึงข้อมูล entities ตามชื่อ                   | ดึง entity ที่ระบุชื่อ                       |
| `read_graph`          | อ่าน knowledge graph ทั้งหมด                 | ดูทั้ง graph structure                       |
| `search_nodes`        | ค้นหา entities ตาม query                     | ค้นหา entity จากชื่อ, type, หรือ observation |

## การใช้งานร่วมกับ Development Flow

**เมื่อบันทึก context ใหม่:**

1. ใช้ `create_entities` เพื่อสร้าง entities ใหม่ (ถ้ายังไม่มี)
2. ใช้ `create_relations` เพื่อเชื่อมโยง entities
3. ใช้ `add_observations` เพื่อเพิ่ม context/observations

**เมื่อค้นหา context:**

1. ใช้ `search_nodes` เพื่อค้นหา entities ที่เกี่ยวข้อง
2. ใช้ `open_nodes` เพื่อดึงข้อมูล entities ที่ต้องการ
3. ใช้ `read_graph` เพื่อดู relations ระหว่าง entities

**เมื่อแก้ไข context:**

1. ใช้ `add_observations` เพื่อเพิ่ม observations ใหม่
2. ใช้ `delete_observations` เพื่อลบ observations ที่ผิด
3. ใช้ `create_relations` หรือ `delete_relations` เพื่อปรับ relations

## ข้อควรระวัง

- **✅ ใช้สำหรับบันทึก context ที่ต้องใช้ร่วมกันหลาย session** — เช่น การตัดสินใจสำคัญ, architecture decisions, rollout history
- **⚠️ ระวังการลบ entities** — อาจทำให้เสีย context ที่ยังใช้งานอยู่
- **✅ ตรวจสอบว่า entity มีอยู่แล้วก่อนสร้าง** — ใช้ `search_nodes` หรือ `open_nodes` ก่อน
- **✅ ใช้ชื่อ entity ที่ชัดเจนและไม่ซ้ำกัน** — เพื่อป้องกันความสับสน
- **⚠️ ข้อมูลไม่ถาวรถ้าไม่ได้ตั้ง `MEMORY_FILE_PATH`** — ค่า default เก็บใน npx cache หายเมื่ออัปเดต package; ตั้งค่าใน `mcp_config.json` ใต้ `env`
